/**
 * #829 — the 1.13c Thunder Storm lightning: the flash state machine `WeatherLightning113c`
 * (ForceLightning 0x6fb301f0, the SpawnAndWind tail 0x6fb30f3c..0x6fb30f4e, the driver 0x6fb305a0),
 * its wiring through `WeatherSim` / `WeatherController` / `WeatherScenePass`, and the flash rect
 * (DrawFlash 0x6fb2fe10 plus the D2DDraw fill clamp 0x6f8c6720).
 */

import { describe, expect, it, vi } from 'vitest'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import { PeriodOfDay } from '../../src/common/world/environment.ts'
import type { AtlasHandle } from '../../src/client/render/renderer.ts'
import {
  SKILL_FN_THUNDER_STORM_113C,
  unitSkillEventForcesLightning113c,
  WeatherController,
  weatherLevelInfo113c,
  type WeatherFrameInput,
} from '../../src/client/weather/weather-controller.ts'
import { LIGHTNING_FLASH_PALETTE_INDEX_113C, lightningFlashRect113c } from '../../src/client/weather/weather-raster.ts'
import {
  WeatherScenePass,
  weatherWorldDrawnFromSidePanels,
  type WeatherDrawTarget,
} from '../../src/client/weather/weather-render-pass.ts'
import {
  LIGHTNING_MIN_FPS_113C,
  NO_LIGHTNING_113C,
  WeatherLightning113c,
  WeatherSim,
} from '../../src/client/weather/weather-sim.ts'
import { loadWeatherManifest } from './weather-golden-scenes.ts'

const SEED_LO = 0x00c0ffee
const SEED_HI = 0x5eed

function seedHex(rng: D2Rng): string {
  const { lo, hi } = rng.getSeed()
  return `${(lo >>> 0).toString(16).padStart(8, '0')}:${(hi >>> 0).toString(16).padStart(8, '0')}`
}

/** Counts every step of `rng` (`rand` steps through `this.step`). */
function countDraws(rng: D2Rng): () => number {
  let n = 0
  const step = rng.step.bind(rng)
  rng.step = (): number => {
    n += 1
    return step()
  }
  return () => n
}

// ── The state machine (reference scenarios S1–S7) ─────────────────────────────────────────────────

type MachineEvent = 'cast' | 'disable' | 'resetWind'

interface MachineScenario {
  readonly rain: boolean
  readonly ticks: number
  readonly events?: Readonly<Record<number, readonly MachineEvent[]>>
  readonly drawn?: (t: number) => boolean
  readonly fps?: (t: number) => number
  readonly verbose?: (t: number) => boolean
}

/**
 * One main-loop iteration per tick: packet events (cast = skill fn #84 → ForceLightning(0)), then the
 * weather step's tail on Rain levels, then the driver when the world is drawn.
 */
function runMachine(sc: MachineScenario): string[] {
  const rng = new D2Rng(SEED_LO, SEED_HI)
  const draws = countDraws(rng)
  const l = new WeatherLightning113c()
  const rows: string[] = []
  for (let t = 1; t <= sc.ticks; t += 1) {
    const events = sc.events?.[t] ?? []
    const tickStart = draws()
    for (const e of events) {
      if (e === 'cast') l.force(0)
      else if (e === 'disable') l.disable()
      else {
        // ResetWind 0x6fb30be0: angle countdown, lightning countdown (0x6fb30c4c), angle.
        rng.rand(375)
        l.countdown = 500 + rng.rand(1500)
        rng.rand(71)
      }
    }
    if (sc.rain) l.tail()
    const drawn = sc.drawn?.(t) ?? true
    const before = draws()
    const out = drawn ? l.drive(rng, sc.fps?.(t) ?? 25) : NO_LIGHTNING_113C
    const driverDraws = draws() - before
    const evDraws = before - tickStart
    if (out.flash || driverDraws > 0 || evDraws > 0 || events.length > 0 || sc.verbose?.(t) === true) {
      rows.push(
        `t=${String(t)}${events.length > 0 ? ` [${events.join('+')}]` : ''} flash=${out.flash ? 1 : 0}` +
          `${drawn ? '' : ' (world not drawn)'} ${evDraws > 0 ? `eventDraws=${String(evDraws)} ` : ''}` +
          `driverDraws=${String(driverDraws)} | en=${String(l.enabled)} trg=${String(l.trigger)} ` +
          `cd=${String(l.countdown)} fs=${String(l.flashState)} arm=${String(l.thunderArmed)} rng=${seedHex(rng)}`,
      )
    }
  }
  return rows
}

describe('WeatherLightning113c (reference scenarios S1–S7)', () => {
  it('S1 Rain level, fps 25: first pair arms closing flash state on every subsequent pair', () => {
    expect(runMachine({ rain: true, ticks: 4000, events: { 1: ['cast'] } })).toEqual([
      't=1 [cast] flash=1 driverDraws=0 | en=1 trg=0 cd=3 fs=1 arm=0 rng=00c0ffee:00005eed',
      't=4 flash=1 driverDraws=1 | en=1 trg=0 cd=1203 fs=0 arm=1 rng=a28f3113:00507fab',
      't=1207 flash=1 driverDraws=0 | en=1 trg=0 cd=3 fs=1 arm=1 rng=a28f3113:00507fab',
      't=1210 flash=1 driverDraws=1 | en=1 trg=0 cd=1650 fs=0 arm=1 rng=76cdf34a:43cd60ff',
      't=2860 flash=1 driverDraws=0 | en=1 trg=0 cd=3 fs=1 arm=1 rng=76cdf34a:43cd60ff',
      't=2863 flash=1 driverDraws=1 | en=1 trg=0 cd=1505 fs=0 arm=1 rng=585f38f1:318d6d36',
    ])
  })

  it('S3 dry level: one flash, then nothing; a second cast while enabled is a no-op', () => {
    expect(runMachine({ rain: false, ticks: 200, events: { 1: ['cast'], 100: ['cast'] } })).toEqual([
      't=1 [cast] flash=1 driverDraws=0 | en=1 trg=0 cd=3 fs=1 arm=0 rng=00c0ffee:00005eed',
      't=100 [cast] flash=0 driverDraws=0 | en=1 trg=0 cd=3 fs=1 arm=0 rng=00c0ffee:00005eed',
    ])
  })

  it('S4 both side panels open t=2..10: the countdown runs below 0, the trigger waits for a drawn frame', () => {
    expect(
      runMachine({
        rain: true,
        ticks: 30,
        events: { 1: ['cast'] },
        drawn: t => !(t >= 2 && t <= 10),
        verbose: t => t <= 12,
      }),
    ).toEqual([
      't=1 [cast] flash=1 driverDraws=0 | en=1 trg=0 cd=3 fs=1 arm=0 rng=00c0ffee:00005eed',
      't=2 flash=0 (world not drawn) driverDraws=0 | en=1 trg=0 cd=2 fs=1 arm=0 rng=00c0ffee:00005eed',
      't=3 flash=0 (world not drawn) driverDraws=0 | en=1 trg=0 cd=1 fs=1 arm=0 rng=00c0ffee:00005eed',
      't=4 flash=0 (world not drawn) driverDraws=0 | en=1 trg=1 cd=0 fs=1 arm=0 rng=00c0ffee:00005eed',
      't=5 flash=0 (world not drawn) driverDraws=0 | en=1 trg=1 cd=-1 fs=1 arm=0 rng=00c0ffee:00005eed',
      't=6 flash=0 (world not drawn) driverDraws=0 | en=1 trg=1 cd=-2 fs=1 arm=0 rng=00c0ffee:00005eed',
      't=7 flash=0 (world not drawn) driverDraws=0 | en=1 trg=1 cd=-3 fs=1 arm=0 rng=00c0ffee:00005eed',
      't=8 flash=0 (world not drawn) driverDraws=0 | en=1 trg=1 cd=-4 fs=1 arm=0 rng=00c0ffee:00005eed',
      't=9 flash=0 (world not drawn) driverDraws=0 | en=1 trg=1 cd=-5 fs=1 arm=0 rng=00c0ffee:00005eed',
      't=10 flash=0 (world not drawn) driverDraws=0 | en=1 trg=1 cd=-6 fs=1 arm=0 rng=00c0ffee:00005eed',
      't=11 flash=1 driverDraws=1 | en=1 trg=0 cd=1203 fs=0 arm=1 rng=a28f3113:00507fab',
      't=12 flash=0 driverDraws=0 | en=1 trg=0 cd=1202 fs=0 arm=1 rng=a28f3113:00507fab',
    ])
  })

  it('S5 fps 9 on the closing flash: no flash drawn, the trigger and the draw are still consumed', () => {
    expect(runMachine({ rain: true, ticks: 10, events: { 1: ['cast'] }, fps: t => (t === 4 ? 9 : 25) })).toEqual([
      't=1 [cast] flash=1 driverDraws=0 | en=1 trg=0 cd=3 fs=1 arm=0 rng=00c0ffee:00005eed',
      't=4 flash=0 driverDraws=1 | en=1 trg=0 cd=1203 fs=0 arm=1 rng=a28f3113:00507fab',
    ])
  })

  it('S6 a disable write (EnterState(3)) stops the countdown; the next cast restarts the pair', () => {
    expect(
      runMachine({
        rain: true,
        ticks: 12,
        events: { 1: ['cast'], 2: ['disable'], 5: ['cast'] },
        verbose: t => t <= 9,
      }),
    ).toEqual([
      't=1 [cast] flash=1 driverDraws=0 | en=1 trg=0 cd=3 fs=1 arm=0 rng=00c0ffee:00005eed',
      't=2 [disable] flash=0 driverDraws=0 | en=0 trg=0 cd=3 fs=1 arm=0 rng=00c0ffee:00005eed',
      't=3 flash=0 driverDraws=0 | en=0 trg=0 cd=3 fs=1 arm=0 rng=00c0ffee:00005eed',
      't=4 flash=0 driverDraws=0 | en=0 trg=0 cd=3 fs=1 arm=0 rng=00c0ffee:00005eed',
      't=5 [cast] flash=1 driverDraws=0 | en=1 trg=0 cd=3 fs=1 arm=0 rng=00c0ffee:00005eed',
      't=6 flash=0 driverDraws=0 | en=1 trg=0 cd=2 fs=1 arm=0 rng=00c0ffee:00005eed',
      't=7 flash=0 driverDraws=0 | en=1 trg=0 cd=1 fs=1 arm=0 rng=00c0ffee:00005eed',
      't=8 flash=1 driverDraws=1 | en=1 trg=0 cd=1203 fs=0 arm=1 rng=a28f3113:00507fab',
      't=9 flash=0 driverDraws=0 | en=1 trg=0 cd=1202 fs=0 arm=1 rng=a28f3113:00507fab',
    ])
  })

  it('S7 ResetWind (SelectPrecip) between the two flashes re-rolls the countdown and splits the pair', () => {
    expect(runMachine({ rain: true, ticks: 4000, events: { 1: ['cast'], 2: ['resetWind'] } })).toEqual([
      't=1 [cast] flash=1 driverDraws=0 | en=1 trg=0 cd=3 fs=1 arm=0 rng=00c0ffee:00005eed',
      't=2 [resetWind] flash=0 eventDraws=3 driverDraws=0 | en=1 trg=0 cd=1649 fs=1 arm=0 rng=585f38f1:318d6d36',
      't=1651 flash=1 driverDraws=1 | en=1 trg=0 cd=1363 fs=0 arm=1 rng=9741ceab:24dbf933',
      't=3014 flash=1 driverDraws=0 | en=1 trg=0 cd=3 fs=1 arm=1 rng=9741ceab:24dbf933',
      't=3017 flash=1 driverDraws=1 | en=1 trg=0 cd=522 fs=0 arm=1 rng=350232ca:3f169202',
      't=3539 flash=1 driverDraws=0 | en=1 trg=0 cd=3 fs=1 arm=1 rng=350232ca:3f169202',
      't=3542 flash=1 driverDraws=1 | en=1 trg=0 cd=1456 fs=0 arm=1 rng=32954774:161c06b5',
    ])
  })

  it('keeps the BSS / .data initial values, game init clears only flashState and enabled', () => {
    const l = new WeatherLightning113c()
    expect([l.enabled, l.trigger, l.countdown, l.flashState, l.thunderArmed]).toEqual([0, 0, 0, 0, 1])
    l.force(0)
    l.countdown = 77
    l.flashState = 1
    l.gameInit()
    expect([l.enabled, l.trigger, l.countdown, l.flashState, l.thunderArmed]).toEqual([0, 1, 77, 0, 0])
  })

  it('fails fast on a bad force arg or fps', () => {
    const rng = new D2Rng(SEED_LO, SEED_HI)
    const l = new WeatherLightning113c()
    expect(() => l.force(2 as 0)).toThrow(/arg 2/)
    expect(() => l.drive(rng, 24.5)).toThrow(/fps/)
    expect(() => l.drive(rng, -1)).toThrow(/fps/)
    l.force(1)
    l.drive(rng, 25)
    expect(LIGHTNING_MIN_FPS_113C).toBe(10)
  })
})

// ── Through the real WeatherSim (reference vectors I1–I3) ─────────────────────────────────────────

const tbl = (k: number): number[] => Array.from({ length: 12 }, (_, i) => (k * 16 + i + 1) & 0xff)

/** Per tick: cast → ForceLightning, the update, the floor pass (no water), the driver (fps 25). */
function runSim(level: number, castTicks: readonly number[], ticks: number): string[] {
  const rng = new D2Rng(SEED_LO, SEED_HI)
  const draws = countDraws(rng)
  const sim = new WeatherSim({ rng, levels: weatherLevelInfo113c })
  sim.onGameInit()
  sim.loadWeather(level, level, {
    colors: { rainDay: tbl(1), rainDuskDawn: tbl(2), rainNight: tbl(3), snowGray: tbl(4) },
    frameCounts: { rain3: 6, rain4: 6, bubble3: 6 },
  })
  const mud = weatherLevelInfo113c(level).mud
  const rows: string[] = []
  let prevState = sim.snapshot().state
  let prevEn = 0
  for (let t = 1; t <= ticks; t += 1) {
    const d0 = draws()
    const cast = castTicks.includes(t)
    if (cast) sim.forceLightning()
    sim.update({ levelId: level, tick: t, camDx: 0, camDy: 0, period: PeriodOfDay.Day, width: 800, height: 600 })
    sim.floorPass([], t, mud)
    const d1 = draws()
    const out = sim.driveLightning(25)
    const d2 = draws()
    const s = sim.snapshot()
    if (cast || out.flash || s.state !== prevState || s.lightningEnabled !== prevEn || d2 !== d1) {
      rows.push(
        `t=${String(t)}${cast ? ' [cast]' : ''} state=${String(s.state)} en=${String(s.lightningEnabled)} ` +
          `flash=${out.flash ? 1 : 0} simDraws=${String(d1 - d0)} driverDraws=${String(d2 - d1)} totalDraws=${String(d2)} ` +
          `lightCd=${String(s.lightCountdown)} fs=${String(s.flashState)} ` +
          `arm=${String(s.thunderArmed)} rng=${seedHex(rng)}`,
      )
    }
    prevState = s.state
    prevEn = s.lightningEnabled
  }
  return rows
}

describe('WeatherSim lightning (reference vectors I1–I3)', () => {
  it('I1 Blood Moor, cast in the full state: the sim draws and the countdown roll interleave', () => {
    const rows = runSim(2, [270], 3200)
    expect(rows.slice(0, 5)).toEqual([
      't=1 state=1 en=0 flash=0 simDraws=5 driverDraws=0 totalDraws=11 lightCd=1507 fs=0 arm=1 rng=466c2a14:13f28531',
      't=260 state=2 en=0 flash=0 simDraws=92 driverDraws=0 totalDraws=12748 lightCd=1507 fs=0 arm=1 rng=b6e0de51:14e08f91',
      't=270 [cast] state=2 en=1 flash=1 simDraws=75 driverDraws=0 totalDraws=13788 lightCd=3 fs=1 arm=0 rng=7d850bfd:649d01a6',
      't=273 state=2 en=1 flash=1 simDraws=85 driverDraws=1 totalDraws=14104 lightCd=1731 fs=0 arm=1 rng=75295bbb:380fb042',
      't=2004 state=2 en=1 flash=1 simDraws=60 driverDraws=0 totalDraws=180823 lightCd=3 fs=1 arm=1 rng=31575bd3:149b33fb',
    ])
    expect(rows[5]).toContain('t=2007 state=2 en=1 flash=1 simDraws=70 driverDraws=1 totalDraws=181109')
    expect(rows).toHaveLength(8)
  })

  it('I2 cast during the ramp-up: FullState switches the lightning off when the full state starts', () => {
    expect(runSim(2, [5], 1200)).toEqual([
      't=1 state=1 en=0 flash=0 simDraws=5 driverDraws=0 totalDraws=11 lightCd=1507 fs=0 arm=1 rng=466c2a14:13f28531',
      't=5 [cast] state=1 en=1 flash=1 simDraws=5 driverDraws=0 totalDraws=31 lightCd=3 fs=1 arm=0 rng=9a6ead49:3f0bfa28',
      't=8 state=1 en=1 flash=1 simDraws=5 driverDraws=1 totalDraws=42 lightCd=1775 fs=0 arm=1 rng=ea184f8f:3f70f87a',
      't=260 state=2 en=0 flash=0 simDraws=82 driverDraws=0 totalDraws=12599 lightCd=1524 fs=0 arm=1 rng=085cfaca:4e5c93b6',
    ])
  })

  it('I3 dry level (8, Den of Evil): one flash and no draws; the second cast is a no-op', () => {
    expect(runSim(8, [5, 50], 100)).toEqual([
      't=5 [cast] state=0 en=1 flash=1 simDraws=0 driverDraws=0 totalDraws=6 lightCd=3 fs=1 arm=0 rng=32954774:161c06b5',
      't=50 [cast] state=0 en=1 flash=0 simDraws=0 driverDraws=0 totalDraws=6 lightCd=3 fs=1 arm=0 rng=32954774:161c06b5',
    ])
  })

  it('ForceLightning needs no LoadWeather; the driver does', () => {
    const sim = new WeatherSim({ rng: new D2Rng(1, 0x5eed), levels: weatherLevelInfo113c })
    sim.onGameInit()
    sim.forceLightning()
    expect(sim.snapshot()).toMatchObject({ lightningEnabled: 1, lightningTrigger: 1, flashState: 0, thunderArmed: 0 })
    expect(() => sim.driveLightning(25)).toThrow(/before loadWeather/)
  })
})

// ── WeatherController: once per tick, the world gate and the FPS gate ─────────────────────────────

function controllerIn(levelId: number, rng = new D2Rng(7, 0x5eed)): WeatherController {
  const c = new WeatherController({ rng })
  c.setAssets(loadWeatherManifest())
  c.onGameInit()
  c.onLoadAct(levelId)
  return c
}

function frame(over: Partial<WeatherFrameInput> = {}): WeatherFrameInput {
  return {
    levelId: 1,
    tick: 1,
    camX: 1000,
    camY: 2000,
    width: 800,
    height: 600,
    period: PeriodOfDay.Day,
    floorTiles: [],
    worldDrawn: true,
    fps: 25,
    ...over,
  }
}

describe('WeatherController lightning', () => {
  it('validates worldDrawn / fps', () => {
    const c = controllerIn(1)
    expect(() => c.beginFrame(frame({ fps: 24.5 }))).toThrow(/fps 24.5/)
    expect(() => c.beginFrame(frame({ fps: -1 }))).toThrow(/fps -1/)
    expect(() => c.beginFrame(frame({ worldDrawn: 1 as unknown as boolean }))).toThrow(/worldDrawn 1/)
  })

  it('runs the driver once per tick and holds its result for the later frames of that tick', () => {
    const rng = new D2Rng(7, 0x5eed)
    const c = controllerIn(1, rng)
    c.beginFrame(frame({ tick: 1 }))
    expect(c.lightningFrame).toBe(NO_LIGHTNING_113C)
    c.forceLightning()
    c.beginFrame(frame({ tick: 2 }))
    expect(c.lightningFrame).toEqual({ flash: true })
    const seed = rng.getSeed()
    c.beginFrame(frame({ tick: 2, camX: 1003 }))
    expect(c.lightningFrame).toEqual({ flash: true })
    expect(rng.getSeed()).toEqual(seed)
    expect(c.sim.snapshot()).toMatchObject({ lightningTrigger: 0, flashState: 1, lightCountdown: 3 })
    const flashes: number[] = []
    for (let tick = 3; tick <= 12; tick += 1) {
      c.beginFrame(frame({ tick }))
      if (c.lightningFrame.flash) flashes.push(tick)
    }
    // Rogue Encampment is a Rain level: three weather steps close the first pair.
    expect(flashes).toEqual([5])
    expect(c.sim.snapshot()).toMatchObject({ flashState: 0, thunderArmed: 1 })
  })

  it('skips the floor pass and the driver while both side panels are open; the trigger waits', () => {
    const c = controllerIn(1)
    c.beginFrame(frame({ tick: 1 }))
    c.forceLightning()
    const floorPass = vi.spyOn(c.sim, 'floorPass')
    expect(c.beginFrame(frame({ tick: 2, worldDrawn: false }))).toBe(true)
    expect(floorPass).not.toHaveBeenCalled()
    expect(c.lightningFrame).toBe(NO_LIGHTNING_113C)
    expect(c.sim.snapshot()).toMatchObject({ lightningEnabled: 1, lightningTrigger: 1, flashState: 0 })
    // The next frame that draws the world (here: still tick 2) runs the driver.
    c.beginFrame(frame({ tick: 2 }))
    expect(floorPass).toHaveBeenCalledTimes(1)
    expect(c.lightningFrame).toEqual({ flash: true })
    // A later frame of the same tick that does not draw the world shows no flash.
    c.beginFrame(frame({ tick: 2, worldDrawn: false }))
    expect(c.lightningFrame).toBe(NO_LIGHTNING_113C)
  })

  it('below 10 fps the trigger and its state step are consumed without a flash', () => {
    const c = controllerIn(1)
    c.beginFrame(frame({ tick: 1 }))
    c.forceLightning()
    c.beginFrame(frame({ tick: 2, fps: 9 }))
    expect(c.lightningFrame).toEqual({ flash: false })
    expect(c.sim.snapshot()).toMatchObject({ lightningTrigger: 0, flashState: 1, lightCountdown: 3 })
    const d = controllerIn(1)
    d.beginFrame(frame({ tick: 1 }))
    d.forceLightning()
    d.beginFrame(frame({ tick: 2, fps: LIGHTNING_MIN_FPS_113C }))
    expect(d.lightningFrame.flash).toBe(true)
  })

  it('a new game drops the held result', () => {
    const c = controllerIn(1)
    c.beginFrame(frame({ tick: 1 }))
    c.forceLightning()
    c.beginFrame(frame({ tick: 2 }))
    expect(c.lightningFrame.flash).toBe(true)
    c.onGameInit()
    expect(c.lightningFrame).toBe(NO_LIGHTNING_113C)
    expect(c.sim.snapshot()).toMatchObject({ lightningEnabled: 0, flashState: 0 })
  })

  it('all 136 levels: the forced flash shows on the next drawn frame; the pair closes 3 steps later only on Rain levels', () => {
    const got: Array<[number, number[]]> = []
    const want: Array<[number, number[]]> = []
    for (let id = 1; id <= 136; id += 1) {
      const c = controllerIn(id, new D2Rng(2000 + id, 0x5eed))
      const flashes: number[] = []
      for (let tick = 1; tick <= 20; tick += 1) {
        if (tick === 2) c.forceLightning()
        c.beginFrame(frame({ levelId: id, tick }))
        if (c.lightningFrame.flash) flashes.push(tick)
      }
      got.push([id, flashes])
      want.push([id, weatherLevelInfo113c(id).rain ? [2, 5] : [2]])
    }
    expect(got).toEqual(want)
  })
})

describe('unitSkillEventForcesLightning113c (S2C 0xA3 → 0x6fb51b10 → fn #84)', () => {
  it('forces only for Thunder Storm (cltprgfunc1 84) with a known caster and a known target', () => {
    expect(SKILL_FN_THUNDER_STORM_113C).toBe(84)
    const ok = { skill: 57, casterKnown: true, targetKnown: true }
    expect(unitSkillEventForcesLightning113c(ok)).toBe(true)
    expect(unitSkillEventForcesLightning113c({ ...ok, casterKnown: false })).toBe(false)
    expect(unitSkillEventForcesLightning113c({ ...ok, targetKnown: false })).toBe(false)
    for (const skill of [49, 254, 357, -1, 1.5]) {
      expect(unitSkillEventForcesLightning113c({ ...ok, skill })).toBe(false)
    }
  })
})

// ── The flash rect and the scene pass ────────────────────────────────────────────────────────────

describe('lightningFlashRect113c (DrawFlash 0x6fb2fe10, D2DDraw clamp 0x6f8c6720)', () => {
  it.each([
    [800, 600, 0, { x1: 0, x2: 799, ymax: 553 }],
    [800, 600, 1, { x1: 0, x2: 400, ymax: 553 }],
    [800, 600, 2, { x1: 400, x2: 799, ymax: 553 }],
    [640, 480, 0, { x1: 0, x2: 639, ymax: 433 }],
    [640, 480, 1, { x1: 0, x2: 320, ymax: 433 }],
    [640, 480, 2, { x1: 320, x2: 639, ymax: 433 }],
    [1022, 700, 0, { x1: 0, x2: 1021, ymax: 653 }],
    [1022, 700, 1, { x1: 0, x2: 512, ymax: 653 }],
    [1022, 700, 2, { x1: 510, x2: 1021, ymax: 653 }],
  ] as const)('%i x %i panel %i', (w, h, panel, want) => {
    expect(lightningFlashRect113c(w, h, panel)).toEqual(want)
  })

  it('drops empty rects and rejects panel 3 or a bad screen', () => {
    expect(lightningFlashRect113c(800, 47, 0)).toBeNull()
    expect(lightningFlashRect113c(800, 46, 0)).toBeNull()
    expect(lightningFlashRect113c(1, 600, 0)).toBeNull()
    expect(() => lightningFlashRect113c(800, 600, 3 as 0)).toThrow(/panel 3/)
    expect(() => lightningFlashRect113c(0, 600, 0)).toThrow(/bad screen/)
    expect(LIGHTNING_FLASH_PALETTE_INDEX_113C).toBe(255)
  })
})

describe('weatherWorldDrawnFromSidePanels (0x6faf4361)', () => {
  it('is false only with both side panels open', () => {
    expect(weatherWorldDrawnFromSidePanels(false, false)).toBe(true)
    expect(weatherWorldDrawnFromSidePanels(true, false)).toBe(true)
    expect(weatherWorldDrawnFromSidePanels(false, true)).toBe(true)
    expect(weatherWorldDrawnFromSidePanels(true, true)).toBe(false)
  })
})

class SolidTarget implements WeatherDrawTarget {
  readonly solids: Array<[number, number, number, number, readonly number[]]> = []

  addIndexedAtlas(_indices: Uint8Array, width: number, height: number): AtlasHandle {
    return { texture: {} as WebGLTexture, width, height, indexed: true }
  }

  draw(): void {}

  drawSolid(...[x, y, w, h, color]: Parameters<WeatherDrawTarget['drawSolid']>): void {
    this.solids.push([x, y, w, h, color])
  }
}

describe('WeatherScenePass lightning flash', () => {
  it('draws one opaque palette-255 rect at the unrounded screen origin instead of the lines', () => {
    const c = controllerIn(1)
    const pass = new WeatherScenePass({
      controller: c,
      period: () => PeriodOfDay.Day,
      panel: () => 1,
      worldDrawn: () => true,
      fps: () => 25,
    })
    const scene = { levelId: 1, camX: 1000.5, camY: 2000.25, width: 800, height: 600, floorTiles: [] }
    pass.beginFrame({ ...scene, tick: 1 })
    c.forceLightning()
    pass.beginFrame({ ...scene, tick: 2 })
    const target = new SolidTarget()
    pass.drawLines(target)
    // Palette index 255 is white in all five act palettes.
    expect(target.solids).toEqual([[1000.5 - 400, 2000.25 - 300, 400, 553, [1, 1, 1, 1]]])
    for (let tick = 3; tick <= 40; tick += 1) pass.beginFrame({ ...scene, tick: tick })
    const after = new SolidTarget()
    pass.drawLines(after)
    // After the flash, DrawParticles resumes: the rain lines are rasterized as 1-pixel-wide coalesced spans
    // (rasterizeWeatherLineSpans, #1028) — never the full-screen palette-255 flash rect again.
    expect(after.solids.length).toBeGreaterThan(0)
    expect(after.solids.every(([, , w, h]) => w === 1 || h === 1)).toBe(true)
    expect(after.solids.some(([, , w, h]) => w === 400 && h === 553)).toBe(false)
  })
})
