#!/usr/bin/env npx tsx
/**
 * Headless Chrome + CDP verifier for the 1.13c client weather (`tools/verify-weather-browser.ts`).
 *
 * Runs `play.html` against the live server through the Vite `/d2net` proxy (WebGL2 on SwiftShader):
 *
 *   Gate 1. Boot and assets: `/assets/weather/weather.json` (version 1: five act palettes, the
 *           Rain3 / Rain4 / bubble3 cels) is installed in the session's WeatherController and the
 *           weather stays off before the first act load. Battle.net login (`d2webbot1`), character
 *           `WebBotOne`, create a game, Rogue Encampment: LoadWeather ran with the Act I palette.
 *   Gate 2. Live 1.13c weather (override `off`): the Rogue Encampment (Levels.txt Rain = 1) starts
 *           raining, and one frame passes the frame check.
 *   Gate 3. Weather override in the automap-reveal plugin (NOT 1.13c): the plugin menu select
 *           (`select[data-plugin-setting="automap-reveal:weatherOverride"]`) switches snow, rain and
 *           off through the settings store into the session weather; each forced mode fills the
 *           pool to the target and passes the frame check. Disabling the plugin restores the
 *           1.13c weather and removes the select; re-enabling restores the stored mode.
 *   Gate 4. All 136 levels: a fresh WeatherSim per level runs 600 weather ticks as if the player
 *           stood in that level (the scene stays the Rogue Encampment; every visible floor tile is
 *           marked as water so splashes and bubbles can spawn), then the frame check. Rain, snow,
 *           splashes and bubbles must follow Levels.txt `Act` / `Rain` / `Mud` read from the MPQs;
 *           the period of day cycles with the level id so every colour ramp gets drawn.
 *   Gate 5. Override sweep: forced rain and forced snow in all 136 levels (simulation only).
 *   Gate 7. Lightning (issue #829). 7a (runs right after Gate 2, live session): ForceLightning(0), as an S2C
 *           0xA3 of Thunder Storm triggers it, on the live Rogue Encampment rain (any weather state, but it must
 *           not change during the gate: entering state 2 or 3 turns the lightning off). The driver runs
 *           once per game tick with the FPS counter `main.ts` feeds; its next run opens the pair
 *           (countdown 3), exactly the third run after it closes the pair silently (countdown
 *           500..1999, thunder armed), and each flash is drawn iff the FPS counter is >= 10.
 *           7b (runs after Gate 5, simulation as in Gate 4, FPS input pinned to 25 so every flash is
 *           drawn): a fresh Rogue Encampment after 600 ticks (state 2) flashes on the first driver run,
 *           again 3 ticks later, then `countdown` ticks later and 3 ticks after that with the thunder
 *           trigger; the first flash passes the flash check and
 *           is screenshotted. 7c: a fresh Den of Evil (Rain = 0, no SpawnAndWind tail) gives exactly one
 *           flash, which passes the flash check, and no thunder.
 *   No console errors and no page exceptions.
 *
 * Flash check: the held flash frame (A) and the frame without the weather (B) at one timestamp. Every
 * pixel of the DrawFlash rect (`lightningFlashRect113c`: [0, W−1) × [0, H−47) with no side panel) must
 * be palette index 255 (white) in A, or equal in A and B (UI drawn after the weather), and at least
 * 90% must be white; outside the rect A and B may only differ inside visible splash / bubble cels, so
 * no rain line is drawn on a flash frame.
 *
 * Frame check: the scene is rendered twice with the same timestamp, with the weather (A) and
 * without it (B), and read back with `readPixels`. Every pixel the line rasterizer
 * (`rasterizeWeatherLines`, D2DDraw DrawLine) writes must hold exactly the act palette colour of
 * its particle in A, and that colour must come from the period's ramp; every other pixel where A
 * and B differ must lie inside the rect of a visible splash or bubble cel; with neither rain nor
 * mud, A and B must be identical. The automap overlay (drawn after the weather) is hidden.
 *
 * Env: `D2W_PUBLIC_DIR` (default `public/`, must hold `act-packs/tiles/index.json` and
 * `assets/weather/weather.json`), `D2_DATA_DIR` (default `samples/d2`, must hold d2data.mpq /
 * d2exp.mpq / Patch_D2.mpq), `CHROME_PATH` (Chrome binary tried first by `tools/find-chrome.ts`; it
 * must give WebGL2 on SwiftShader). The bot password comes from `scratch/bot-accounts.json`
 * (written by `tools/d2-bot.ts`). Screenshots and `levels-weather-audit.json` are written to
 * `scratch/verify-weather/`.
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
const OUT_DIR = resolve(ROOT_DIR, 'scratch/verify-weather')
const LOG = '[verify-weather]'

/** Gate 4 weather ticks per level: the ramp-up lasts 250..499 ticks, so every Rain level is at full strength. */
const AUDIT_TICKS = 600
/** Gate 5 weather ticks per level and forced mode. */
const OVERRIDE_TICKS = 100
/** Gate 4 screenshots: rain, dry, rain + bubbles, and the four Act V snow cases. */
const LEVEL_SHOTS: ReadonlySet<number> = new Set([1, 8, 75, 109, 117, 120, 136])
/** The 1.13c 800×600 mode the frame check maps the weather onto. */
const VIEW_W = 800
const VIEW_H = 600
const WEATHER_MODES = ['off', 'rain', 'snow'] as const
type WeatherMode = (typeof WEATHER_MODES)[number]

/** Levels.txt columns the weather reads (D2Common #10459 / #10215 / #10499). */
interface LevelWeatherRow {
  readonly id: number
  readonly name: string
  /** `Act` + 1. */
  readonly act: number
  readonly rain: boolean
  readonly mud: boolean
}

/** The four LoadWeather colour ramps (12 palette indices each) of the act being drawn. */
interface ColorRamps {
  readonly rainDay: readonly number[]
  readonly rainDuskDawn: readonly number[]
  readonly rainNight: readonly number[]
  readonly snowGray: readonly number[]
}

interface FrameDetail {
  readonly snow: boolean
  readonly state: number
  readonly forced: number
  readonly target: number
  readonly particles: number
  readonly splashes: number
  readonly bubbles: number
  readonly lines: {
    readonly pixels: number
    readonly exact: number
    readonly mismatch: number
    readonly sameAsBg: number
    readonly offCanvas: number
    readonly firstMismatch: unknown
  }
  readonly colors: readonly number[]
  readonly ramps: ColorRamps
  readonly overlays: { readonly visSplashes: number; readonly visBubbles: number }
  readonly diff: {
    readonly total: number
    readonly onLines: number
    readonly inOverlays: number
    readonly outside: number
    readonly firstOutside: unknown
  }
}

/** Result of the in-page frame check (`window.__wx.check()`). */
interface FrameCheck {
  readonly W: number
  readonly H: number
  readonly camX: number
  readonly camY: number
  readonly levelId: number
  readonly tick: number
  readonly period: number
  readonly envPeriod: number
  readonly originX: number
  readonly originY: number
  readonly cw: number
  readonly ch: number
  readonly drew: boolean
  readonly glError: number
  /** Why there is no detail: `not drawn` or `fractional camera`. */
  readonly reason: string | null
  readonly detail: FrameDetail | null
}

interface LevelAudit {
  readonly level: number
  readonly info: { readonly act: number; readonly rain: boolean; readonly mud: boolean }
  readonly period: number
  readonly act5Case: number
  readonly ticks: number
  readonly extraTicks: number
  readonly maxSplashes: number
  readonly maxBubbles: number
  readonly frame: FrameCheck
}

interface OverrideSweepEntry {
  readonly level: number
  readonly mode: WeatherMode
  readonly override: string
  readonly snow: boolean
  readonly particles: number
  readonly target: number
  readonly state: number
  readonly forced: number
}

/** The weather override as every layer sees it (`WEATHER_STATE_JS`). */
interface OverrideState {
  readonly setting: string
  readonly controller: string
  readonly sim: string
  readonly plugin: string | null
  readonly stored: string
  readonly enabled: boolean
  readonly select: string | null
  readonly options: readonly string[] | null
  readonly snow: boolean
  readonly particles: number
  readonly target: number
  readonly state: number
  readonly forced: number
  readonly period: number
}

/** The lightning globals as `WeatherLightning113c` holds them. */
interface LightningGlobals {
  readonly enabled: number
  readonly trigger: number
  readonly countdown: number
  readonly flashState: number
  readonly thunderArmed: number
}

/** A Gate 7 simulation tick whose driver run flashed or thundered (`window.__wx.lightningRun`). */
interface LightningEvent {
  readonly tick: number
  readonly flash: boolean
  readonly thunder: boolean
  readonly state: number
  readonly lightning: LightningGlobals
}

interface LightningRun {
  readonly tick: number
  readonly state: number
  readonly events: readonly LightningEvent[]
  readonly lightning: LightningGlobals
}

/** One driver run of the live simulation (`window.__wx.lightningLiveArm` probe). */
interface LiveDriverRun {
  readonly i: number
  readonly tick: number | null
  readonly fps: number
  /** Weather state right after the run. */
  readonly state: number
  readonly before: LightningGlobals
  readonly after: LightningGlobals
  readonly flash: boolean
  readonly thunder: boolean
  readonly thunderCalls: number
}

/** Result of the in-page flash check (`window.__wx.flashCheck()`). */
interface FlashCheck {
  readonly W: number
  readonly H: number
  readonly drew: boolean
  readonly flash: boolean
  readonly glError: number
  readonly rect: { readonly x1: number; readonly x2: number; readonly ymax: number } | null
  /** Flash rect on the canvas: x, y, width, height. */
  readonly canvasRect: readonly number[]
  /** Why there is no detail: `fractional flash rect`. */
  readonly reason: string | null
  readonly detail: {
    readonly white: readonly number[]
    readonly inside: {
      readonly area: number
      readonly white: number
      readonly sameAsB: number
      readonly other: number
      readonly firstOther: unknown
    }
    readonly outside: { readonly inCels: number; readonly other: number; readonly firstOutside: unknown }
  } | null
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function fail(message: string, detail?: unknown): never {
  throw new Error(detail === undefined ? message : `${message}: ${JSON.stringify(detail)}`)
}

/** Levels.txt `Act` / `Rain` / `Mud` of levels 1..136, read from the 1.13c MPQs. */
async function loadLevelWeather(): Promise<ReadonlyMap<number, LevelWeatherRow>> {
  const dir = resolve(ROOT_DIR, process.env.D2_DATA_DIR ?? 'samples/d2')
  const archives = new MountedArchives()
  for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
    const path = join(dir, name)
    if (!existsSync(path)) fail(`Missing ${path}; set D2_DATA_DIR to the 1.13c MPQ directory`)
    archives.add(name, await MpqArchive.open(await fileSource(path)))
  }
  const table = parseTable(await archives.read('data\\global\\excel\\Levels.txt'))
  for (const column of ['Id', 'Name', 'Act', 'Rain', 'Mud']) {
    if (!table.header.includes(column)) fail(`Levels.txt has no column ${column}`)
  }
  const flag = (id: number, column: string, raw: readonly string[]): boolean => {
    const text = cell(table, raw, column).trim()
    if (text !== '' && text !== '0' && text !== '1') fail(`Levels.txt level ${String(id)}: ${column} = '${text}'`)
    return text === '1'
  }
  const byId = new Map<number, LevelWeatherRow>()
  for (const raw of table.rows) {
    const idText = cell(table, raw, 'Id').trim()
    if (!/^\d+$/.test(idText)) continue
    const id = Number(idText)
    if (id < 1 || id > 136) continue
    if (byId.has(id)) fail(`Levels.txt has two rows for level ${String(id)}`)
    const act = Number(cell(table, raw, 'Act').trim() || 'NaN')
    if (!Number.isInteger(act) || act < 0 || act > 4) fail(`Levels.txt level ${String(id)}: Act ${String(act)}`)
    byId.set(id, {
      id,
      name: cell(table, raw, 'Name').trim(),
      act: act + 1,
      rain: flag(id, 'Rain', raw),
      mud: flag(id, 'Mud', raw),
    })
  }
  for (let id = 1; id <= 136; id++) {
    if (!byId.has(id)) fail(`Levels.txt has no row for level ${String(id)}`)
  }
  return byId
}

/** Rain colours Spawn 0x6fb30700 picks for a period: DAY, DUSK / DAWN or NIGHT ramp. */
function rainRamp(ramps: ColorRamps, period: number): readonly number[] {
  switch (period) {
    case 0:
      return ramps.rainDay
    case 1:
    case 3:
      return ramps.rainDuskDawn
    case 2:
      return ramps.rainNight
    default:
      return fail(`period ${String(period)} is not 0..3`)
  }
}

/** Palette indices SnowColor 0x6fb304c0 (GDI / DirectDraw branch) gives flakes of size 0..7. */
function snowColors(gray: readonly number[], period: number): ReadonlySet<number> {
  const out = new Set<number>()
  for (let size = 0; size < 8; size++) {
    const idx = Math.trunc((size * 12) / 8)
    const at = period === 0 ? idx : period === 2 ? Math.trunc(idx / 4) : Math.trunc(idx / 2)
    const color = gray[at]
    if (color === undefined) fail(`snow ramp has no index ${String(at)}`)
    out.add(color)
  }
  return out
}

/** Colours the live particles may hold when every one was spawned in one of `periods`. */
function expectedColors(d: FrameDetail, periods: readonly number[]): ReadonlySet<number> {
  const out = new Set<number>()
  for (const period of periods) {
    const colors = d.snow ? snowColors(d.ramps.snowGray, period) : rainRamp(d.ramps, period)
    for (const color of colors) out.add(color)
  }
  return out
}

/** Problems of one frame check that hold in every gate. */
function frameProblems(label: string, f: FrameCheck, allowedColors: ReadonlySet<number> | null): string[] {
  const d = f.detail
  if (d === null) {
    return [`${label}: no frame check (${String(f.reason)}; drew ${String(f.drew)}, camera ${String(f.camX)},${String(f.camY)})`]
  }
  const out: string[] = []
  if (f.W !== VIEW_W || f.H !== VIEW_H || f.cw !== f.W || f.ch !== f.H) {
    out.push(`${label}: canvas ${String(f.W)}x${String(f.H)}, weather screen ${String(f.cw)}x${String(f.ch)}`)
  }
  if (f.originX !== f.camX - f.W / 2 || f.originY !== f.camY - f.H / 2) {
    out.push(
      `${label}: weather origin (${String(f.originX)}, ${String(f.originY)}) is not the camera top-left (${String(f.camX - f.W / 2)}, ${String(f.camY - f.H / 2)})`,
    )
  }
  if (f.glError !== 0) out.push(`${label}: WebGL error ${String(f.glError)}`)
  if (d.lines.offCanvas !== 0) out.push(`${label}: ${String(d.lines.offCanvas)} line pixels map outside the canvas`)
  if (d.lines.mismatch !== 0) {
    out.push(
      `${label}: ${String(d.lines.mismatch)} of ${String(d.lines.pixels)} line pixels are not the palette colour, first ${JSON.stringify(d.lines.firstMismatch)}`,
    )
  }
  if (d.diff.outside !== 0) {
    out.push(
      `${label}: ${String(d.diff.outside)} changed pixels outside the lines and the overlay cels, first ${JSON.stringify(d.diff.firstOutside)}`,
    )
  }
  if (allowedColors !== null) {
    const bad = d.colors.filter((c) => !allowedColors.has(c))
    if (bad.length > 0) {
      out.push(`${label}: line colours ${JSON.stringify(bad)} are not in the ramp ${JSON.stringify([...allowedColors])}`)
    }
  }
  if (d.overlays.visSplashes + d.overlays.visBubbles > 0 && d.diff.inOverlays === 0) {
    out.push(`${label}: ${String(d.overlays.visSplashes + d.overlays.visBubbles)} visible splash / bubble cels changed no pixel`)
  }
  return out
}

/** Gate 4 problems of one level against Levels.txt. */
function levelProblems(row: LevelWeatherRow, r: LevelAudit): string[] {
  const label = `level ${String(row.id)} ${row.name}`
  const out: string[] = []
  if (r.info.act !== row.act || r.info.rain !== row.rain || r.info.mud !== row.mud) {
    out.push(`${label}: baked Act/Rain/Mud ${JSON.stringify(r.info)} differ from Levels.txt`)
  }
  const f = r.frame
  const d = f.detail
  if (d === null) return [...out, ...frameProblems(label, f, null)]
  out.push(...frameProblems(label, f, row.rain ? expectedColors(d, [r.period]) : null))
  if (f.levelId !== row.id || f.period !== r.period) {
    out.push(`${label}: frame drawn for level ${String(f.levelId)}, period ${String(f.period)}`)
  }
  if (row.rain) {
    if (d.particles === 0 || d.particles !== d.target) out.push(`${label}: ${String(d.particles)} particles, target ${String(d.target)}`)
    if (d.state !== 2) out.push(`${label}: state ${String(d.state)} after ${String(r.ticks)} ticks (want 2, full)`)
    if (d.lines.pixels === 0) out.push(`${label}: no rain / snow pixels drawn`)
    if (d.splashes === 0) out.push(`${label}: no splashes on water`)
    if (row.act !== 5 && d.snow) out.push(`${label}: snow outside Act V`)
    // Only Act V case 0 (levels 109..112) rolls RNG(100) < 25 for rain on each ramp-up.
    if (row.act === 5 && !d.snow && r.act5Case !== 0) out.push(`${label}: Act V case ${String(r.act5Case)} rains`)
  } else if (d.particles !== 0 || d.splashes !== 0 || r.maxSplashes !== 0 || d.lines.pixels !== 0) {
    out.push(
      `${label}: weather without Rain (${String(d.particles)} particles, ${String(r.maxSplashes)} splashes, ${String(d.lines.pixels)} line pixels)`,
    )
  }
  if (row.mud) {
    if (d.bubbles === 0) out.push(`${label}: no bubbles`)
  } else if (d.bubbles !== 0 || r.maxBubbles !== 0) {
    out.push(`${label}: bubbles without Mud`)
  }
  if (!row.rain && !row.mud && d.diff.total !== 0) out.push(`${label}: ${String(d.diff.total)} pixels changed in a dry level`)
  return out
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

/** Password of the `d2webbot1` bot account (never printed). */
function readBotPassword(): string {
  const path = resolve(ROOT_DIR, 'scratch/bot-accounts.json')
  if (!existsSync(path)) fail(`Missing ${path}; create the bot accounts with tools/d2-bot.ts first`)
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
    accounts?: Record<string, { password?: string }>
  }
  const password = parsed.accounts?.d2webbot1?.password
  if (!password) fail(`${path} has no password for d2webbot1`)
  return password
}

async function waitForApp(cdp: CdpSession): Promise<void> {
  for (let i = 0; i < 150; i++) {
    const ready = await cdp.evaluate<boolean>(`Boolean(window.__d2Play && window.__d2Play.ready)`)
    if (ready) return
    await sleep(200)
  }
  fail('Timed out waiting for window.__d2Play.ready', {
    consoleErrors: cdp.consoleErrors,
    pageExceptions: cdp.pageExceptions,
  })
}

/** Gate 1a: the baked weather assets are served and installed; no weather before the first act load. */
async function gateAssets(cdp: CdpSession): Promise<void> {
  const res = await cdp.evaluate<{
    httpOk: boolean
    version: number | null
    jsonCels: { rain3: number; rain4: number; bubble3: number } | null
    installed: boolean
    palettes: number[] | null
    cels: { rain3: number; rain4: number; bubble3: number } | null
    atlas: [number, number, number] | null
    active: boolean
    plugin: { enabled: boolean; active: boolean } | null
  }>(`(async () => {
    const app = window.__d2Play;
    const r = await fetch('/weather/weather.json');
    const json = r.ok ? await r.json() : null;
    const c = app.session.weather;
    const a = c.assets;
    const plugin = app.plugins.list().find((p) => p.id === 'automap-reveal');
    return {
      httpOk: r.ok,
      version: json ? json.version : null,
      jsonCels: json ? { rain3: json.cels.rain3.length, rain4: json.cels.rain4.length, bubble3: json.cels.bubble3.length } : null,
      installed: a !== null,
      palettes: a ? a.palettes.map((p) => p.length) : null,
      cels: a ? { rain3: a.cels.rain3.length, rain4: a.cels.rain4.length, bubble3: a.cels.bubble3.length } : null,
      atlas: a ? [a.atlas.width, a.atlas.height, a.atlas.indices.length] : null,
      active: c.active,
      plugin: plugin ? { enabled: plugin.enabled, active: plugin.active } : null,
    };
  })()`)
  console.log(`${LOG} Gate 1a (assets):`, JSON.stringify(res))
  const cels = res.cels
  if (
    !res.httpOk ||
    res.version !== 1 ||
    !res.installed ||
    JSON.stringify(res.palettes) !== JSON.stringify([768, 768, 768, 768, 768]) ||
    cels === null ||
    JSON.stringify(cels) !== JSON.stringify(res.jsonCels) ||
    cels.rain3 === 0 ||
    cels.rain4 === 0 ||
    cels.bubble3 === 0 ||
    res.atlas === null ||
    res.atlas[0] * res.atlas[1] !== res.atlas[2] ||
    res.active ||
    res.plugin?.enabled !== true ||
    res.plugin.active !== true
  ) {
    fail('Gate 1 failed: weather assets / plugin before the game', res)
  }
}

/** Gate 1b: Battle.net login, character select, create a game, Rogue Encampment. */
async function enterGame(cdp: CdpSession, botPassword: string): Promise<void> {
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
    // The login edit box caps typed passwords at 15 characters (flow-state.ts) but the d2-bot
    // accounts have 16-character passwords, so the field is assigned directly.
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
  console.log(`${LOG} Gate 1b (login):`, JSON.stringify(login, null, 1))
  if (login.lobbyStage !== 'bnet_lobby' || login.sessionPhase !== 'lobby' || !login.selectedChar) {
    fail('Gate 1 failed: Battle.net login / character select', login)
  }

  const gameName = `wbwx${Date.now() % 100000}`
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
  console.log(`${LOG} Gate 1c (game):`, { gameName, ...ingame })
  if (ingame.phase !== 'ingame' || ingame.areaId !== 1 || ingame.selfId <= 0 || ingame.tilePages === 0) {
    fail('Gate 1 failed: create game / enter the Rogue Encampment', ingame)
  }
  await cdp.evaluate(`window.__d2Play.settings.update({ lightingPreset: 'auto', viewport: '800x600' })`)
}

/** Gate 1d: LoadWeather ran for the act load, with the Act I palette. */
async function gateLoaded(cdp: CdpSession): Promise<void> {
  let res: { active: boolean; loaded: boolean; actOnePalette: boolean; override: string } | null = null
  for (let i = 0; i < 50; i++) {
    res = await cdp.evaluate(`(() => {
      const c = window.__d2Play.session.weather;
      return {
        active: c.active,
        loaded: c.sim.isLoaded,
        actOnePalette: c.active && c.palette === c.assets.palettes[0],
        override: c.override,
      };
    })()`)
    if (res?.active) break
    await sleep(100)
  }
  console.log(`${LOG} Gate 1d (LoadWeather):`, res)
  if (!res?.active || !res.loaded || !res.actOnePalette || res.override !== 'off') {
    fail('Gate 1 failed: LoadWeather did not run for the Rogue Encampment', res)
  }
}

/**
 * Installs `window.__wx`: a probe on the controller's `beginFrame` (mode `pass` = untouched, `off`
 * = no weather this frame, `audit` = the level / tick / period of the audit), the frame check, the
 * Gate 4 / Gate 5 level runners and `restore()`.
 */
const INSTALL_JS = `(async () => {
  const app = window.__d2Play;
  const c = app.session.weather;
  if (Object.prototype.hasOwnProperty.call(c, 'beginFrame')) throw new Error('weather probe already installed');
  const proto = Object.getPrototypeOf(c);
  const raster = await import('/src/client/weather/weather-raster.ts');
  const simMod = await import('/src/client/weather/weather-sim.ts');
  const rngMod = await import('/src/common/rng/d2-rng.ts');
  const ctlMod = await import('/src/client/weather/weather-controller.ts');
  const st = { mode: 'pass', level: 0, tick: 0, period: 0, lastInput: null, drawInput: null, drew: false, liveSim: c.sim };
  c.beginFrame = (input) => {
    st.lastInput = input;
    if (st.mode === 'off') {
      st.drew = false;
      return false;
    }
    const use = st.mode === 'audit' ? { ...input, levelId: st.level, tick: st.tick, period: st.period } : input;
    st.drawInput = use;
    st.drew = proto.beginFrame.call(c, use);
    return st.drew;
  };

  const ramps = (act) => {
    const t = c.colorTablesByAct.get(act);
    if (t === undefined) throw new Error('no colour ramps for act ' + act);
    return { rainDay: [...t.rainDay], rainDuskDawn: [...t.rainDuskDawn], rainNight: [...t.rainNight], snowGray: [...t.snowGray] };
  };

  // Canvas rects of the splash / bubble cels the weather draws this frame (DrawCels visibility).
  const celMask = (W, H, offX, offY) => {
    const mask = new Uint8Array(W * H);
    const cels = c.assets.cels;
    let visSplashes = 0;
    let visBubbles = 0;
    const stamp = (o, frames) => {
      const f = frames[o.frame];
      const x0 = c.originX + o.x + f.ox - offX;
      const y0 = c.originY + o.y + f.oy - f.h - offY;
      for (let y = Math.max(0, y0); y < Math.min(H, y0 + f.h); y += 1) {
        for (let x = Math.max(0, x0); x < Math.min(W, x0 + f.w); x += 1) mask[y * W + x] = 1;
      }
    };
    raster.forEachVisibleWeatherOverlay(c.sim.splashes, c.width, c.height, 0, (o) => {
      visSplashes += 1;
      stamp(o, o.type === 2 ? cels.rain3 : cels.rain4);
    });
    raster.forEachVisibleWeatherOverlay(c.sim.bubbles, c.width, c.height, 0, (o) => {
      visBubbles += 1;
      stamp(o, cels.bubble3);
    });
    return { mask, visSplashes, visBubbles };
  };

  const check = () => {
    const hud = app.hudManager;
    if (hud.leftPanel !== 'none' || hud.rightPanel !== 'none') throw new Error('a side panel is open');
    const mode = st.mode;
    if (mode === 'off') throw new Error('frame check with the weather off');
    const canvas = document.getElementById('view');
    const gl = canvas.getContext('webgl2');
    const minimapWas = app.minimap.visible;
    app.minimap.visible = false;
    try {
      while (gl.getError() !== gl.NO_ERROR) {}
      const t = performance.now();
      st.drawInput = null;
      app.renderFrame(t);
      const W = canvas.width;
      const H = canvas.height;
      const A = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, A);
      const input = st.drawInput;
      const drew = st.drew;
      st.mode = 'off';
      app.renderFrame(t);
      const B = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, B);
      st.mode = mode;
      const glError = gl.getError();
      if (input === null) throw new Error('the weather beginFrame did not run');
      const offX = input.camX - W / 2;
      const offY = input.camY - H / 2;
      const base = {
        W, H, camX: input.camX, camY: input.camY, levelId: input.levelId, tick: input.tick, period: input.period,
        envPeriod: app.session.environment.period, originX: c.originX, originY: c.originY, cw: c.width, ch: c.height,
        drew, glError,
      };
      if (!drew) return { ...base, reason: 'not drawn', detail: null };
      if (!Number.isInteger(offX) || !Number.isInteger(offY)) return { ...base, reason: 'fractional camera', detail: null };

      // Rain / snow pixels in write order (a later write to a pixel wins), mapped to the canvas.
      const pal = c.palette;
      const exp = new Map();
      let offCanvas = 0;
      raster.rasterizeWeatherLines(
        { particles: c.sim.particles, snow: c.sim.snow, angle: c.sim.angle }, c.width, c.height, 0,
        (x, y, color) => {
          const cx = c.originX + x - offX;
          const cy = c.originY + y - offY;
          if (cx < 0 || cx >= W || cy < 0 || cy >= H) {
            offCanvas += 1;
            return;
          }
          exp.set(cy * W + cx, color);
        },
      );
      let exact = 0;
      let mismatch = 0;
      let sameAsBg = 0;
      let firstMismatch = null;
      const colors = new Set();
      for (const [p, color] of exp) {
        colors.add(color);
        const y = Math.floor(p / W);
        const x = p - y * W;
        const i = ((H - 1 - y) * W + x) * 4;
        const want = [pal[color * 3], pal[color * 3 + 1], pal[color * 3 + 2]];
        if (A[i] === want[0] && A[i + 1] === want[1] && A[i + 2] === want[2]) {
          exact += 1;
        } else {
          mismatch += 1;
          if (firstMismatch === null) {
            firstMismatch = { x, y, color, want, got: [A[i], A[i + 1], A[i + 2]], bg: [B[i], B[i + 1], B[i + 2]] };
          }
        }
        if (A[i] === B[i] && A[i + 1] === B[i + 1] && A[i + 2] === B[i + 2]) sameAsBg += 1;
      }

      // Rects of the splash / bubble cels drawn this frame (DrawCels visibility).
      const { mask, visSplashes, visBubbles } = celMask(W, H, offX, offY);

      let total = 0;
      let onLines = 0;
      let inOverlays = 0;
      let outside = 0;
      let firstOutside = null;
      for (let y = 0; y < H; y += 1) {
        const row = (H - 1 - y) * W;
        for (let x = 0; x < W; x += 1) {
          const i = (row + x) * 4;
          if (A[i] === B[i] && A[i + 1] === B[i + 1] && A[i + 2] === B[i + 2]) continue;
          total += 1;
          const p = y * W + x;
          if (exp.has(p)) {
            onLines += 1;
          } else if (mask[p] === 1) {
            inOverlays += 1;
          } else {
            outside += 1;
            if (firstOutside === null) firstOutside = { x, y, a: [A[i], A[i + 1], A[i + 2]], b: [B[i], B[i + 1], B[i + 2]] };
          }
        }
      }
      const s = c.sim.snapshot();
      return {
        ...base,
        reason: null,
        detail: {
          snow: c.sim.snow,
          state: s.state,
          forced: s.forced,
          target: s.target,
          particles: c.sim.particles.count,
          splashes: c.sim.splashes.count,
          bubbles: c.sim.bubbles.count,
          lines: { pixels: exp.size, exact, mismatch, sameAsBg, offCanvas, firstMismatch },
          colors: [...colors].sort((a, b) => a - b),
          ramps: ramps(ctlMod.weatherLevelInfo113c(input.levelId).act),
          overlays: { visSplashes, visBubbles },
          diff: { total, onLines, inOverlays, outside, firstOutside },
        },
      };
    } finally {
      st.mode = mode;
      app.minimap.visible = minimapWas;
    }
  };

  // Game init + act load of a fresh simulation for level L (BSS state of a new client process).
  const freshSim = (L, seed) => {
    const sim = new simMod.WeatherSim({ rng: new rngMod.D2Rng(seed >>> 0, 0x5eed), levels: ctlMod.weatherLevelInfo113c });
    c.sim = sim;
    c.onGameInit();
    c.onLoadAct(L);
    return sim;
  };

  const auditLevel = (L, period, ticks, keepDrawing) => {
    const base = st.lastInput;
    if (base === null) throw new Error('no weather frame input recorded yet');
    const info = ctlMod.weatherLevelInfo113c(L);
    const sim = freshSim(L, 0x5eed0000 + L);
    st.level = L;
    st.period = period;
    const water = base.floorTiles.map((t) => ({ ...t, materialFlags: (t.materialFlags ?? 0) | ctlMod.DT1_MATERIAL_WATER }));
    let maxSplashes = 0;
    let maxBubbles = 0;
    let tick = 0;
    const step = () => {
      tick += 1;
      st.tick = tick;
      if (!proto.beginFrame.call(c, { ...base, levelId: L, tick, period, floorTiles: water })) {
        throw new Error('level ' + L + ': beginFrame returned false');
      }
      maxSplashes = Math.max(maxSplashes, sim.splashes.count);
      maxBubbles = Math.max(maxBubbles, sim.bubbles.count);
    };
    while (tick < ticks) step();
    // Splashes spawn every 4 ticks and bubbles every 26: step on until the expected ones are alive.
    let extraTicks = 0;
    while (extraTicks < 60 && ((info.rain && sim.splashes.count === 0) || (info.mud && sim.bubbles.count === 0))) {
      step();
      extraTicks += 1;
    }
    st.mode = 'audit';
    try {
      const frame = check();
      return { level: L, info, period, act5Case: simMod.act5WeatherCase(L), ticks: tick, extraTicks, maxSplashes, maxBubbles, frame };
    } finally {
      st.mode = keepDrawing ? 'audit' : 'off';
    }
  };

  const overrideLevel = (L, mode, ticks) => {
    const base = st.lastInput;
    if (base === null) throw new Error('no weather frame input recorded yet');
    const sim = new simMod.WeatherSim({ rng: new rngMod.D2Rng((0x0e1d0000 + L) >>> 0, 0x5eed), levels: ctlMod.weatherLevelInfo113c });
    sim.setOverride(mode, L);
    c.sim = sim;
    c.onGameInit();
    c.onLoadAct(L);
    for (let tick = 1; tick <= ticks; tick += 1) {
      if (!proto.beginFrame.call(c, { ...base, levelId: L, tick, floorTiles: [] })) {
        throw new Error('level ' + L + ': beginFrame returned false');
      }
    }
    const s = sim.snapshot();
    return { level: L, mode, override: sim.override, snow: sim.snow, particles: sim.particles.count, target: s.target, state: s.state, forced: s.forced };
  };

  // Back to the live simulation; LoadWeather runs again for the live level (as on an act load).
  const restore = () => {
    c.sim = st.liveSim;
    c.onLoadAct(app.session.world.areaId);
    st.mode = 'pass';
  };

  // Gate 7 flash check: the held flash frame (A) against the frame without the weather (B).
  const flashCheck = () => {
    const hud = app.hudManager;
    if (hud.leftPanel !== 'none' || hud.rightPanel !== 'none') throw new Error('a side panel is open');
    const mode = st.mode;
    if (mode === 'off') throw new Error('flash check with the weather off');
    const canvas = document.getElementById('view');
    const gl = canvas.getContext('webgl2');
    const minimapWas = app.minimap.visible;
    app.minimap.visible = false;
    try {
      while (gl.getError() !== gl.NO_ERROR) {}
      const t = performance.now();
      st.drawInput = null;
      app.renderFrame(t);
      const W = canvas.width;
      const H = canvas.height;
      const A = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, A);
      const input = st.drawInput;
      const drew = st.drew;
      const flash = c.lightningFrame.flash;
      st.mode = 'off';
      app.renderFrame(t);
      const B = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, B);
      st.mode = mode;
      const glError = gl.getError();
      if (input === null) throw new Error('the weather beginFrame did not run');
      const offX = input.camX - W / 2;
      const offY = input.camY - H / 2;
      // DrawFlash is a screen rect at the frame origin (WeatherScenePass.drawLines, no side panel open).
      const rect = raster.lightningFlashRect113c(c.width, c.height, 0);
      const rx = rect === null ? 0 : c.frameOriginX + rect.x1 - offX;
      const ry = c.frameOriginY - offY;
      const rw = rect === null ? 0 : rect.x2 - rect.x1;
      const rh = rect === null ? 0 : rect.ymax;
      const base = { W, H, drew, flash, glError, rect, canvasRect: [rx, ry, rw, rh] };
      if (!Number.isInteger(rx) || !Number.isInteger(ry)) return { ...base, reason: 'fractional flash rect', detail: null };
      const pal = c.palette;
      const white = [pal[765], pal[766], pal[767]];
      const { mask } = celMask(W, H, offX, offY);
      let inWhite = 0;
      let inSame = 0;
      let inOther = 0;
      let firstOther = null;
      let outCels = 0;
      let outOther = 0;
      let firstOutside = null;
      for (let y = 0; y < H; y += 1) {
        const row = (H - 1 - y) * W;
        for (let x = 0; x < W; x += 1) {
          const i = (row + x) * 4;
          const same = A[i] === B[i] && A[i + 1] === B[i + 1] && A[i + 2] === B[i + 2];
          if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) {
            if (A[i] === white[0] && A[i + 1] === white[1] && A[i + 2] === white[2]) {
              inWhite += 1;
            } else if (same) {
              inSame += 1;
            } else {
              inOther += 1;
              if (firstOther === null) firstOther = { x, y, a: [A[i], A[i + 1], A[i + 2]], b: [B[i], B[i + 1], B[i + 2]] };
            }
          } else if (!same) {
            if (mask[y * W + x] === 1) {
              outCels += 1;
            } else {
              outOther += 1;
              if (firstOutside === null) firstOutside = { x, y, a: [A[i], A[i + 1], A[i + 2]], b: [B[i], B[i + 1], B[i + 2]] };
            }
          }
        }
      }
      return {
        ...base,
        reason: null,
        detail: {
          white,
          inside: { area: rw * rh, white: inWhite, sameAsB: inSame, other: inOther, firstOther },
          outside: { inCels: outCels, other: outOther, firstOutside },
        },
      };
    } finally {
      st.mode = mode;
      app.minimap.visible = minimapWas;
    }
  };

  // Gate 7 simulation: a fresh simulation of level L, 'warm' weather ticks, then ForceLightning(0) (what
  // an S2C 0xA3 of Thunder Storm triggers). lightningRun steps on (one weather tick and one driver run
  // per tick, FPS input pinned to 25) until 'flashes' flashes were seen in total or 'maxTicks' ticks
  // ran, then holds the last tick on screen ('audit' mode: no step, no driver run, a flash stays).
  const lightningSnap = () => {
    const l = c.sim.lightning;
    return { enabled: l.enabled, trigger: l.trigger, countdown: l.countdown, flashState: l.flashState, thunderArmed: l.thunderArmed };
  };
  const lightningSteps = (maxTicks, flashes) => {
    const base = st.lastInput;
    const L = st.lt.L;
    for (let n = 0; n < maxTicks; n += 1) {
      st.tick += 1;
      const input = { ...base, levelId: L, tick: st.tick, period: st.period, floorTiles: [], worldDrawn: true, fps: 25 };
      if (!proto.beginFrame.call(c, input)) throw new Error('level ' + L + ': beginFrame returned false');
      const lf = c.lightningFrame;
      if (lf.flash || lf.thunder) {
        st.lt.events.push({ tick: st.tick, flash: lf.flash, thunder: lf.thunder, state: c.sim.snapshot().state, lightning: lightningSnap() });
        if (flashes !== null && st.lt.events.filter((e) => e.flash).length >= flashes) break;
      }
    }
  };
  const lightningStart = (L, seed, warm) => {
    const base = st.lastInput;
    if (base === null) throw new Error('no weather frame input recorded yet');
    st.mode = 'off';
    freshSim(L, seed);
    st.level = L;
    st.period = base.period;
    st.tick = 0;
    st.lt = { L, events: [] };
    lightningSteps(warm, null);
    if (st.lt.events.length !== 0) throw new Error('level ' + L + ': lightning before ForceLightning');
    const state = c.sim.snapshot().state;
    c.forceLightning();
    st.mode = 'audit';
    return { tick: st.tick, state, events: [], lightning: lightningSnap() };
  };
  const lightningRun = (maxTicks, flashes) => {
    st.mode = 'off';
    try {
      lightningSteps(maxTicks, flashes);
    } finally {
      st.mode = 'audit';
    }
    return { tick: st.tick, state: c.sim.snapshot().state, events: st.lt.events, lightning: lightningSnap() };
  };

  // Gate 7 live: log every lightning driver run of the live simulation (the FPS input main.ts feeds),
  // then ForceLightning(0). Disarming removes the probe and turns the lightning off again.
  const lightningLiveArm = () => {
    const sim = st.liveSim;
    if (c.sim !== sim) throw new Error('the live simulation is not installed');
    if (Object.prototype.hasOwnProperty.call(sim, 'driveLightning')) throw new Error('live lightning probe already armed');
    const l = sim.lightning;
    const snap = () => ({ enabled: l.enabled, trigger: l.trigger, countdown: l.countdown, flashState: l.flashState, thunderArmed: l.thunderArmed });
    const orig = Object.getPrototypeOf(sim).driveLightning;
    st.liveLog = [];
    sim.driveLightning = (fps) => {
      const before = snap();
      const r = orig.call(sim, fps);
      if (st.liveLog.length < 5000) {
        st.liveLog.push({ i: st.liveLog.length, tick: st.lastInput === null ? null : st.lastInput.tick, fps, state: sim.snapshot().state, before, after: snap(), flash: r.flash, thunder: r.thunder, thunderCalls: r.thunder ? 1 : 0 });
      }
      return r;
    };
    const s = sim.snapshot();
    c.forceLightning();
    return { state: s.state, forced: s.forced, snow: sim.snow, lightning: snap() };
  };
  const lightningLiveLog = () => {
    const log = st.liveLog;
    const consuming = log.filter((e) => e.before.enabled !== 0 && e.before.trigger !== 0);
    let ticksIncrease = true;
    for (let k = 1; k < log.length; k += 1) {
      if (log[k].tick === null || log[k - 1].tick === null || log[k].tick <= log[k - 1].tick) ticksIncrease = false;
    }
    const fps = log.map((e) => e.fps);
    const upto = consuming.length >= 2 ? consuming[1].i + 1 : log.length;
    const states = [...new Set(log.slice(0, upto).map((e) => e.state))];
    return { runs: log.length, consuming, ticksIncrease, minFps: Math.min(...fps), maxFps: Math.max(...fps), states };
  };
  const lightningLiveDisarm = () => {
    const sim = st.liveSim;
    delete sim.driveLightning;
    sim.lightning.disable();
    return sim.lightning.enabled;
  };

  window.__wx = {
    st, check, auditLevel, overrideLevel, restore,
    flashCheck, lightningStart, lightningRun, lightningLiveArm, lightningLiveLog, lightningLiveDisarm,
  };
  return true;
})()`

/** The weather override as the settings, controller, simulation, plugin and plugin menu see it. */
const WEATHER_STATE_JS = `(() => {
  const app = window.__d2Play;
  const c = app.session.weather;
  const s = c.sim.snapshot();
  const sel = document.querySelector('select[data-plugin-setting="automap-reveal:weatherOverride"]');
  const inst = app.plugins.getInstance('automap-reveal');
  return {
    setting: app.settings.get().weatherOverride,
    controller: c.override,
    sim: c.sim.override,
    plugin: inst ? inst.getWeatherOverride() : null,
    stored: app.plugins.getSetting('automap-reveal', 'weatherOverride'),
    enabled: app.plugins.isEnabled('automap-reveal'),
    select: sel ? sel.value : null,
    options: sel ? Array.from(sel.options).map((o) => o.value) : null,
    snow: c.sim.snow,
    particles: c.sim.particles.count,
    target: s.target,
    state: s.state,
    forced: s.forced,
    period: app.session.environment.period,
  };
})()`

/** Gate 2: the 1.13c weather of the Rogue Encampment (Levels.txt Rain = 1) with the override off. */
async function gateLive(cdp: CdpSession): Promise<void> {
  let state: OverrideState | null = null
  for (let i = 0; i < 150; i++) {
    state = await cdp.evaluate<OverrideState>(WEATHER_STATE_JS)
    // A few streaks: right after the ramp-up starts the first ones can still be above the screen.
    if (state.particles >= 16) break
    await sleep(200)
  }
  console.log(`${LOG} Gate 2 (live weather):`, state)
  if (
    state === null ||
    state.particles < 16 ||
    state.setting !== 'off' ||
    state.controller !== 'off' ||
    state.sim !== 'off' ||
    state.forced !== 0 ||
    state.snow ||
    (state.state !== 1 && state.state !== 2)
  ) {
    fail('Gate 2 failed: the Rogue Encampment does not rain with the 1.13c weather', state)
  }
  const frame = await cdp.evaluate<FrameCheck>(`window.__wx.check()`)
  const after = await cdp.evaluate<number>(`window.__d2Play.session.environment.period`)
  const d = frame.detail
  const problems = frameProblems('Gate 2', frame, d === null ? null : expectedColors(d, [...new Set([state.period, after])]))
  if (frame.levelId !== 1) problems.push(`Gate 2: frame drawn for level ${String(frame.levelId)}`)
  if (d !== null && (d.lines.pixels === 0 || d.snow || d.particles === 0)) {
    problems.push(`Gate 2: ${String(d.particles)} particles drew ${String(d.lines.pixels)} pixels (snow ${String(d.snow)})`)
  }
  console.log(`${LOG} Gate 2 (frame):`, summarizeFrame(frame))
  if (problems.length > 0) fail('Gate 2 failed', problems)
  await cdp.evaluate(`window.__d2Play.minimap.visible = false`)
  await sleep(150)
  await cdp.captureScreenshot(join(OUT_DIR, 'weather-live-rain.png'))
}

/** Compact log line of a frame check. */
function summarizeFrame(f: FrameCheck): Record<string, unknown> {
  const d = f.detail
  return {
    level: f.levelId,
    period: f.period,
    cam: [f.camX, f.camY],
    origin: [f.originX, f.originY],
    reason: f.reason,
    ...(d === null
      ? {}
      : {
          snow: d.snow,
          state: d.state,
          particles: d.particles,
          target: d.target,
          splashes: d.splashes,
          bubbles: d.bubbles,
          linePixels: d.lines.pixels,
          lineMismatch: d.lines.mismatch,
          colors: d.colors,
          visibleCels: d.overlays.visSplashes + d.overlays.visBubbles,
          diff: [d.diff.total, d.diff.onLines, d.diff.inOverlays, d.diff.outside],
        }),
    glError: f.glError,
  }
}

async function chooseWeather(cdp: CdpSession, mode: WeatherMode): Promise<OverrideState> {
  await cdp.evaluate(`(() => {
    const sel = document.querySelector('select[data-plugin-setting="automap-reveal:weatherOverride"]');
    if (!sel) throw new Error('no select[data-plugin-setting="automap-reveal:weatherOverride"]');
    sel.value = ${JSON.stringify(mode)};
    if (sel.value !== ${JSON.stringify(mode)}) throw new Error('the weather select has no option ${mode}');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  })()`)
  return cdp.evaluate<OverrideState>(WEATHER_STATE_JS)
}

function sameOverride(s: OverrideState, mode: WeatherMode): boolean {
  return (
    s.setting === mode &&
    s.controller === mode &&
    s.sim === mode &&
    s.plugin === mode &&
    s.stored === mode &&
    s.select === mode
  )
}

/** Gate 3: weatherOverride setting in automap-reveal plugin end to end (plugin menu select → settings → session weather). */
async function gateOverride(cdp: CdpSession): Promise<void> {
  const start = await cdp.evaluate<OverrideState>(WEATHER_STATE_JS)
  console.log(`${LOG} Gate 3 (start):`, start)
  if (!start.enabled || JSON.stringify(start.options) !== JSON.stringify(WEATHER_MODES) || !sameOverride(start, 'off')) {
    fail('Gate 3 failed: the weather select is missing or not on Default (1.13c)', start)
  }
  for (const mode of ['snow', 'rain'] as const) {
    const chosen = await chooseWeather(cdp, mode)
    if (!sameOverride(chosen, mode)) fail(`Gate 3 failed: choosing ${mode} did not reach every layer`, chosen)
    let filled: OverrideState | null = null
    for (let i = 0; i < 50; i++) {
      filled = await cdp.evaluate<OverrideState>(WEATHER_STATE_JS)
      if (filled.target > 0 && filled.particles === filled.target && filled.snow === (mode === 'snow')) break
      await sleep(100)
    }
    console.log(`${LOG} Gate 3 (${mode}):`, filled)
    if (
      filled === null ||
      filled.target === 0 ||
      filled.particles !== filled.target ||
      filled.snow !== (mode === 'snow') ||
      filled.state !== 2 ||
      filled.forced !== 1
    ) {
      fail(`Gate 3 failed: forced ${mode} is not held at full strength`, filled)
    }
    const frame = await cdp.evaluate<FrameCheck>(`window.__wx.check()`)
    const after = await cdp.evaluate<number>(`window.__d2Play.session.environment.period`)
    const d = frame.detail
    const problems = frameProblems(`Gate 3 ${mode}`, frame, d === null ? null : expectedColors(d, [...new Set([filled.period, after])]))
    if (d !== null && (d.lines.pixels === 0 || d.snow !== (mode === 'snow'))) {
      problems.push(`Gate 3 ${mode}: ${String(d.lines.pixels)} line pixels, snow ${String(d.snow)}`)
    }
    console.log(`${LOG} Gate 3 (${mode} frame):`, summarizeFrame(frame))
    if (problems.length > 0) fail(`Gate 3 failed (${mode})`, problems)
    await sleep(150)
    await cdp.captureScreenshot(join(OUT_DIR, `weather-override-${mode}.png`))
  }
  const off = await chooseWeather(cdp, 'off')
  console.log(`${LOG} Gate 3 (off):`, off)
  if (!sameOverride(off, 'off') || off.forced !== 0) fail('Gate 3 failed: Default (1.13c) did not release the forced weather', off)

  // Disabling releases the claim (1.13c weather, no select); re-enabling restores the stored mode.
  await chooseWeather(cdp, 'snow')
  await cdp.evaluate(`window.__d2Play.plugins.setEnabled('automap-reveal', false)`)
  const disabled = await cdp.evaluate<OverrideState>(WEATHER_STATE_JS)
  console.log(`${LOG} Gate 3 (disabled):`, disabled)
  if (
    disabled.enabled ||
    disabled.setting !== 'off' ||
    disabled.controller !== 'off' ||
    disabled.sim !== 'off' ||
    disabled.plugin !== null ||
    disabled.select !== null ||
    disabled.stored !== 'snow' ||
    disabled.forced !== 0
  ) {
    fail('Gate 3 failed: disabling the plugin did not restore the 1.13c weather', disabled)
  }
  await cdp.evaluate(`window.__d2Play.plugins.setEnabled('automap-reveal', true)`)
  const enabled = await cdp.evaluate<OverrideState>(WEATHER_STATE_JS)
  console.log(`${LOG} Gate 3 (re-enabled):`, enabled)
  if (!enabled.enabled || !sameOverride(enabled, 'snow') || !enabled.snow) {
    fail('Gate 3 failed: re-enabling the plugin did not restore the stored mode', enabled)
  }
  const final = await chooseWeather(cdp, 'off')
  if (!sameOverride(final, 'off') || final.forced !== 0) fail('Gate 3 failed: could not return to Default (1.13c)', final)
}

/** Countdown the second flash of a pair rolls: `500 + RNG(1500)` (0x6fb30655). */
function pairGapOk(v: number): boolean {
  return Number.isInteger(v) && v >= 500 && v <= 1999
}

/** Compact log line of a flash check. */
function summarizeFlash(f: FlashCheck): Record<string, unknown> {
  return {
    drew: f.drew,
    flash: f.flash,
    rect: f.canvasRect,
    reason: f.reason,
    ...(f.detail === null ? {} : { white: f.detail.white, inside: f.detail.inside, outside: f.detail.outside }),
    glError: f.glError,
  }
}

/** Flash check (see the header): DrawFlash [0, W−1) × [0, H−47) of palette index 255, no rain lines. */
function flashProblems(label: string, f: FlashCheck): string[] {
  const out: string[] = []
  if (f.W !== VIEW_W || f.H !== VIEW_H) out.push(`${label}: canvas ${String(f.W)}x${String(f.H)}`)
  if (!f.drew) out.push(`${label}: the weather was not drawn`)
  if (!f.flash) out.push(`${label}: no flash held`)
  if (f.glError !== 0) out.push(`${label}: GL error ${String(f.glError)}`)
  const want = [0, 0, f.W - 1, f.H - 47]
  if (JSON.stringify(f.canvasRect) !== JSON.stringify(want)) {
    out.push(`${label}: flash rect ${JSON.stringify(f.canvasRect)}, want ${JSON.stringify(want)}`)
  }
  const d = f.detail
  if (f.reason !== null || d === null) {
    out.push(`${label}: ${String(f.reason)}`)
    return out
  }
  if (JSON.stringify(d.white) !== JSON.stringify([255, 255, 255])) out.push(`${label}: palette index 255 is ${JSON.stringify(d.white)}`)
  if (d.inside.other > 0) {
    out.push(`${label}: ${String(d.inside.other)} flash pixels are neither white nor UI, first ${JSON.stringify(d.inside.firstOther)}`)
  }
  if (d.inside.white < 0.9 * d.inside.area) out.push(`${label}: only ${String(d.inside.white)} of ${String(d.inside.area)} flash pixels are white`)
  if (d.outside.other > 0) {
    out.push(`${label}: ${String(d.outside.other)} pixels changed outside the flash and the cels, first ${JSON.stringify(d.outside.firstOutside)}`)
  }
  return out
}

/** `window.__wx.lightningLiveLog()`: the live driver runs since ForceLightning. */
interface LiveLightningLog {
  readonly runs: number
  /** Runs that found the trigger set (each one is a flash, drawn iff fps >= 10). */
  readonly consuming: readonly LiveDriverRun[]
  readonly ticksIncrease: boolean
  readonly minFps: number
  readonly maxFps: number
  /** Distinct weather states up to the second trigger run. */
  readonly states: readonly number[]
}

/**
 * Gate 7a (issue #829): ForceLightning(0) on the live Rogue Encampment rain; every driver run is logged with
 * the FPS counter `main.ts` feeds, then the probe is removed and the lightning turned off again. The
 * SpawnAndWind tail runs in every state of a Rain level, so any state will do, but it must not change
 * during the gate (entering state 2 or 3 turns the lightning off).
 */
async function gateLightningLive(cdp: CdpSession): Promise<void> {
  let s = await cdp.evaluate<OverrideState>(WEATHER_STATE_JS)
  for (let i = 0; i < 100 && s.state !== 2; i++) {
    await sleep(100)
    s = await cdp.evaluate<OverrideState>(WEATHER_STATE_JS)
  }
  if (!sameOverride(s, 'off') || s.forced !== 0 || s.snow) {
    fail('Gate 7a failed: the live Rogue Encampment does not run its 1.13c rain', s)
  }
  const armed = await cdp.evaluate<{ readonly state: number; readonly lightning: LightningGlobals }>(
    `window.__wx.lightningLiveArm()`,
  )
  console.log(`${LOG} Gate 7a (ForceLightning):`, armed)
  const l0 = armed.lightning
  if (l0.enabled !== 1 || l0.trigger !== 1 || l0.flashState !== 0 || l0.thunderArmed !== 0) {
    fail('Gate 7a failed: ForceLightning(0) did not set enabled 1, trigger 1, flashState 0, thunderArmed 0', armed)
  }
  let log: LiveLightningLog | null = null
  try {
    for (let i = 0; i < 600; i++) {
      log = await cdp.evaluate<LiveLightningLog>(`window.__wx.lightningLiveLog()`)
      if (log.consuming.length >= 2) break
      await sleep(100)
    }
  } finally {
    const enabled = await cdp.evaluate<number>(`window.__wx.lightningLiveDisarm()`)
    if (enabled !== 0) fail('Gate 7a failed: could not turn the live lightning off', enabled)
  }
  const problems: string[] = []
  const a = log?.consuming[0]
  const b = log?.consuming[1]
  if (log === null || a === undefined || b === undefined) {
    problems.push(`7a: ${String(log?.consuming.length)} trigger runs in ${String(log?.runs)} driver runs`)
  } else {
    if (a.i !== 0 || a.before.flashState !== 0 || a.after.countdown !== 3 || a.after.flashState !== 1 || a.thunder) {
      problems.push(`7a: the next driver run did not open the pair: ${JSON.stringify(a)}`)
    }
    if (
      b.i !== a.i + 3 ||
      b.before.flashState !== 1 ||
      b.after.flashState !== 0 ||
      !pairGapOk(b.after.countdown) ||
      b.after.thunderArmed !== 1 ||
      b.thunder ||
      b.thunderCalls !== 0
    ) {
      problems.push(`7a: the third driver run after it did not close the pair silently: ${JSON.stringify(b)}`)
    }
    for (const r of [a, b]) {
      if (r.flash !== r.fps >= 10) problems.push(`7a: driver run ${String(r.i)} at fps ${String(r.fps)} returned flash ${String(r.flash)}`)
    }
    if (!log.ticksIncrease) problems.push('7a: the driver ran twice in one game tick')
    if (!(log.maxFps > 0)) problems.push(`7a: the FPS counter is not fed (max ${String(log.maxFps)})`)
    if (JSON.stringify(log.states) !== JSON.stringify([armed.state])) {
      problems.push(`7a: the weather state went ${String(armed.state)} -> ${JSON.stringify(log.states)} during the gate`)
    }
  }
  console.log(`${LOG} Gate 7a (driver runs):`, {
    runs: log?.runs,
    fps: [log?.minFps, log?.maxFps],
    states: log?.states,
    ticksIncrease: log?.ticksIncrease,
    pair: log?.consuming.slice(0, 2).map((r) => ({ i: r.i, tick: r.tick, fps: r.fps, flash: r.flash, ...r.after })),
  })
  if (problems.length > 0) fail('Gate 7a failed', problems)
}

/** Gate 7 simulation seeds (one fresh weather RNG per level) and tick counts. */
const LIGHTNING_SEED = 0x11a90000
const LIGHTNING_WARM_TICKS = 600
const LIGHTNING_DRY_TICKS = 300

/**
 * Gate 7b / 7c (issue #829): lightning on fresh simulations as in Gate 4 (FPS input 25): the Rogue
 * Encampment pairs and thunder, the Den of Evil single flash; the first flash of each is frame-checked.
 */
async function gateLightningSim(cdp: CdpSession): Promise<void> {
  const forced = (r: LightningRun): boolean =>
    r.lightning.enabled === 1 && r.lightning.trigger === 1 && r.lightning.flashState === 0 && r.lightning.thunderArmed === 0

  // 7b: the Rogue Encampment (Rain = 1) at full rain.
  const start = await cdp.evaluate<LightningRun>(
    `window.__wx.lightningStart(1, ${String(LIGHTNING_SEED + 1)}, ${String(LIGHTNING_WARM_TICKS)})`,
  )
  console.log(`${LOG} Gate 7b (ForceLightning):`, { tick: start.tick, state: start.state, lightning: start.lightning })
  if (start.state !== 2 || !forced(start)) fail('Gate 7b failed: ForceLightning(0) at full rain', start)
  const first = await cdp.evaluate<LightningRun>(`window.__wx.lightningRun(1, 1)`)
  const f1 = first.events[0]
  if (
    first.events.length !== 1 ||
    f1 === undefined ||
    f1.tick !== start.tick + 1 ||
    !f1.flash ||
    f1.thunder ||
    f1.lightning.countdown !== 3 ||
    f1.lightning.flashState !== 1
  ) {
    fail('Gate 7b failed: the first driver run after ForceLightning did not open a pair', first)
  }
  const frame = await cdp.evaluate<FlashCheck>(`window.__wx.flashCheck()`)
  console.log(`${LOG} Gate 7b (flash frame):`, summarizeFlash(frame))
  const fp = flashProblems('Gate 7b', frame)
  if (fp.length > 0) fail('Gate 7b failed: flash frame', fp)
  await sleep(150)
  await cdp.captureScreenshot(join(OUT_DIR, 'weather-lightning-flash.png'))

  // Flash 2 three ticks later arms the thunder; after `countdown` ticks flash 3, three ticks later flash 4 thunders.
  const rest = await cdp.evaluate<LightningRun>(`window.__wx.lightningRun(${String(3 + 1999 + 3)}, 4)`)
  const ev = rest.events
  console.log(
    `${LOG} Gate 7b (pairs):`,
    ev.map((e) => ({ tick: e.tick, flash: e.flash, state: e.state, thunder: e.thunder, ...e.lightning })),
  )
  const problems: string[] = []
  const [, e2, e3, e4] = ev
  if (ev.length !== 4 || e2 === undefined || e3 === undefined || e4 === undefined || ev.some((e) => !e.flash || e.state !== 2)) {
    problems.push(`7b: ${String(ev.length)} driver events, want 4 flashes in state 2`)
  } else {
    if (
      e2.tick !== f1.tick + 3 ||
      e2.thunder ||
      e2.lightning.flashState !== 0 ||
      !pairGapOk(e2.lightning.countdown) ||
      e2.lightning.thunderArmed !== 1
    ) {
      problems.push(`7b: flash 2 did not close the first pair silently 3 ticks later: ${JSON.stringify(e2)}`)
    }
    if (e3.tick !== e2.tick + e2.lightning.countdown || e3.thunder || e3.lightning.countdown !== 3 || e3.lightning.flashState !== 1) {
      problems.push(`7b: flash 3 did not open the second pair after the countdown: ${JSON.stringify(e3)}`)
    }
    if (
      e4.tick !== e3.tick + 3 ||
      !e4.thunder ||
      e4.lightning.flashState !== 0 ||
      !pairGapOk(e4.lightning.countdown)
    ) {
      problems.push(`7b: flash 4 did not trigger thunder 3 ticks after flash 3: ${JSON.stringify(e4)}`)
    }
  }
  if (problems.length > 0) fail('Gate 7b failed', problems)

  // 7c: the Den of Evil (Rain = 0): the SpawnAndWind tail never runs, so the pair never closes.
  const dryStart = await cdp.evaluate<LightningRun>(`window.__wx.lightningStart(8, ${String(LIGHTNING_SEED + 8)}, 50)`)
  if (!forced(dryStart)) fail('Gate 7c failed: ForceLightning(0) in the Den of Evil', dryStart)
  const dryFirst = await cdp.evaluate<LightningRun>(`window.__wx.lightningRun(1, 1)`)
  const d1 = dryFirst.events[0]
  if (dryFirst.events.length !== 1 || d1 === undefined || d1.tick !== dryStart.tick + 1 || !d1.flash || d1.thunder) {
    fail('Gate 7c failed: the first driver run after ForceLightning did not flash', dryFirst)
  }
  const dryFrame = await cdp.evaluate<FlashCheck>(`window.__wx.flashCheck()`)
  console.log(`${LOG} Gate 7c (flash frame):`, summarizeFlash(dryFrame))
  const dp = flashProblems('Gate 7c', dryFrame)
  if (dp.length > 0) fail('Gate 7c failed: flash frame', dp)
  const dry = await cdp.evaluate<LightningRun>(`window.__wx.lightningRun(${String(LIGHTNING_DRY_TICKS)}, null)`)
  console.log(`${LOG} Gate 7c (Den of Evil):`, { ticks: dry.tick - dryStart.tick, flashes: dry.events.length, lightning: dry.lightning })
  const l = dry.lightning
  if (dry.events.length !== 1 || l.enabled !== 1 || l.trigger !== 0 || l.countdown !== 3 || l.flashState !== 1 || l.thunderArmed !== 0) {
    fail('Gate 7c failed: a dry level must give exactly one flash and keep the pair open', dry)
  }
}

/** Gate 4: the 1.13c weather of every level 1..136 (fresh simulation, rendered, frame-checked). */
async function gateLevels(cdp: CdpSession, levels: ReadonlyMap<number, LevelWeatherRow>): Promise<void> {
  await cdp.evaluate(`window.__wx.st.mode = 'off'`)
  const results: { readonly row: LevelWeatherRow; readonly r: LevelAudit }[] = []
  const problems: string[] = []
  for (let id = 1; id <= 136; id++) {
    const row = levels.get(id)
    if (row === undefined) fail(`no Levels.txt row for level ${String(id)}`)
    const period = (id - 1) % 4
    const shot = LEVEL_SHOTS.has(id)
    const r = await cdp.evaluate<LevelAudit>(
      `window.__wx.auditLevel(${String(id)}, ${String(period)}, ${String(AUDIT_TICKS)}, ${String(shot)})`,
    )
    results.push({ row, r })
    problems.push(...levelProblems(row, r))
    if (shot) {
      // The audit tick is frozen, so the live frames keep drawing exactly the audited weather.
      await sleep(200)
      await cdp.captureScreenshot(join(OUT_DIR, `weather-level-${String(id).padStart(3, '0')}.png`))
      await cdp.evaluate(`window.__wx.st.mode = 'off'`)
    }
  }

  const audit = results.map(({ row, r }) => {
    const d = r.frame.detail
    return {
      id: row.id,
      name: row.name,
      act: row.act,
      rain: row.rain,
      mud: row.mud,
      period: r.period,
      act5Case: r.act5Case,
      ticks: r.ticks,
      extraTicks: r.extraTicks,
      maxSplashes: r.maxSplashes,
      maxBubbles: r.maxBubbles,
      camera: [r.frame.camX, r.frame.camY],
      glError: r.frame.glError,
      reason: r.frame.reason,
      ...(d === null
        ? {}
        : {
            snow: d.snow,
            state: d.state,
            target: d.target,
            particles: d.particles,
            splashes: d.splashes,
            bubbles: d.bubbles,
            lines: { pixels: d.lines.pixels, exact: d.lines.exact, mismatch: d.lines.mismatch, sameAsBg: d.lines.sameAsBg },
            colors: d.colors,
            visibleCels: d.overlays,
            diff: { total: d.diff.total, onLines: d.diff.onLines, inOverlays: d.diff.inOverlays, outside: d.diff.outside },
          }),
    }
  })
  writeFileSync(join(OUT_DIR, 'levels-weather-audit.json'), JSON.stringify(audit, null, 1))

  const withDetail = results.filter(({ r }) => r.frame.detail !== null)
  const rainLevels = results.filter(({ row }) => row.rain).map(({ row }) => row.id)
  const snowLevels = withDetail.filter(({ row, r }) => row.rain && r.frame.detail?.snow === true).map(({ row }) => row.id)
  const mudLevels = results.filter(({ row }) => row.mud).map(({ row }) => row.id)
  const linePixels = withDetail.reduce((n, { r }) => n + (r.frame.detail?.lines.pixels ?? 0), 0)
  console.log(`${LOG} Gate 4 (136-level weather audit):`, {
    levels: results.length,
    rainLevels,
    snowLevels,
    mudLevels,
    linePixels,
    problems: problems.length,
  })
  if (results.length !== 136 || problems.length > 0) fail('Gate 4 failed', problems.slice(0, 30))
}

/** Gate 5: forced rain and forced snow hold at full strength in every level 1..136. */
async function gateOverrideSweep(cdp: CdpSession): Promise<void> {
  const entries = await cdp.evaluate<OverrideSweepEntry[]>(`(() => {
    const out = [];
    for (let id = 1; id <= 136; id++) {
      for (const mode of ['rain', 'snow']) out.push(window.__wx.overrideLevel(id, mode, ${String(OVERRIDE_TICKS)}));
    }
    return out;
  })()`)
  const problems: string[] = []
  for (const e of entries) {
    if (
      e.override !== e.mode ||
      e.snow !== (e.mode === 'snow') ||
      e.target === 0 ||
      e.particles !== e.target ||
      e.state !== 2 ||
      e.forced !== 1
    ) {
      problems.push(`level ${String(e.level)} forced ${e.mode}: ${JSON.stringify(e)}`)
    }
  }
  console.log(`${LOG} Gate 5 (override sweep):`, { runs: entries.length, problems: problems.length })
  if (entries.length !== 272 || problems.length > 0) fail('Gate 5 failed', problems.slice(0, 30))
}

/** Back to the live simulation and the plain `beginFrame`; the weather must run again. */
async function restoreLive(cdp: CdpSession): Promise<void> {
  await cdp.evaluate(`window.__wx.restore()`)
  let res: { live: boolean; active: boolean; actOnePalette: boolean } | null = null
  for (let i = 0; i < 50; i++) {
    res = await cdp.evaluate(`(() => {
      const c = window.__d2Play.session.weather;
      return {
        live: c.sim === window.__wx.st.liveSim,
        active: c.active,
        actOnePalette: c.active && c.palette === c.assets.palettes[0],
      };
    })()`)
    // `active` is still set by the last audit: wait for the next frame's LoadWeather of the live level.
    if (res?.live && res.active && res.actOnePalette) break
    await sleep(100)
  }
  await cdp.evaluate(`delete window.__d2Play.session.weather.beginFrame`)
  console.log(`${LOG} restore:`, res)
  if (!res?.live || !res.active || !res.actOnePalette) fail('Restoring the live weather failed', res)
}

async function main(): Promise<void> {
  const chromeBin = findChromeBinary()
  mkdirSync(OUT_DIR, { recursive: true })
  const publicDir = process.env.D2W_PUBLIC_DIR ? resolve(process.env.D2W_PUBLIC_DIR) : resolve(ROOT_DIR, 'public')
  for (const rel of ['act-packs/tiles/index.json', 'assets/weather/weather.json']) {
    const path = join(publicDir, rel)
    if (!existsSync(path)) fail(`Missing ${path}; set D2W_PUBLIC_DIR=<path/to/public>`)
  }
  const levels = await loadLevelWeather()
  const botPassword = readBotPassword()

  let viteServer: ViteDevServer | null = null
  const userDataDir = mkdtempSync(join(tmpdir(), 'd2-verify-weather-'))
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
    console.log(`${LOG} Vite server listening at ${targetUrl}`)

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

    await waitForApp(cdp)
    await gateAssets(cdp)
    await enterGame(cdp, botPassword)
    await gateLoaded(cdp)
    await cdp.evaluate(INSTALL_JS)
    await gateLive(cdp)
    await gateLightningLive(cdp)
    await gateOverride(cdp)
    await gateLevels(cdp, levels)
    await gateOverrideSweep(cdp)
    await gateLightningSim(cdp)
    await restoreLive(cdp)

    if (cdp.consoleErrors.length > 0 || cdp.pageExceptions.length > 0) {
      fail('Unexpected console/page errors', { consoleErrors: cdp.consoleErrors, pageExceptions: cdp.pageExceptions })
    }
    console.log(`${LOG} PASS — all gates passed; screenshots and levels-weather-audit.json in ${OUT_DIR}`)
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
  console.error(`${LOG} FATAL:`, err)
  process.exit(1)
})
