/**
 * Diablo II 1.13c client weather simulation (src/client/weather/weather-sim.ts) against the
 * D2Client.dll 1.13c reconstruction in docs/weather_113c.md.
 *
 * RNG-order checks replay the dedicated seed with a clone; everything else checks the vanilla
 * formulas, ranges and quirks listed there.
 */

import { describe, expect, it } from 'vitest'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import { PeriodOfDay } from '../../src/common/world/environment.ts'
import { CANONICAL_LEVEL_LIGHTING } from '../../src/common/world/levels-meta.ts'
import {
  act5WeatherCase,
  F32_RAIN_SPEED_BASE,
  F32_RAIN_SPEED_INTENSITY,
  WeatherSim,
  type WeatherColorTables,
  type WeatherLevelInfo,
  type WeatherStepInput,
} from '../../src/client/weather/weather-sim.ts'

const W = 800
const H = 600

function levels(id: number): WeatherLevelInfo {
  const def = CANONICAL_LEVEL_LIGHTING[id]
  if (def === undefined) throw new Error(`unknown level ${String(id)}`)
  return { act: def.act, rain: def.rain, mud: def.mud }
}

function ramp(start: number): number[] {
  return Array.from({ length: 12 }, (_, i) => start + i)
}

const COLORS: WeatherColorTables = {
  rainDay: ramp(10),
  rainDuskDawn: ramp(30),
  rainNight: ramp(50),
  snowGray: ramp(70),
}
const FRAMES = { rain3: 10, rain4: 10, bubble3: 12 }

function newSim(seed: number): { sim: WeatherSim; rng: D2Rng } {
  const rng = new D2Rng(seed >>> 0, 0x5eed)
  const sim = new WeatherSim({ rng, levels })
  sim.onGameInit()
  return { sim, rng }
}

function load(sim: WeatherSim, actLevel: number, playerLevel = actLevel): void {
  sim.loadWeather(actLevel, playerLevel, { colors: COLORS, frameCounts: FRAMES })
}

function step(sim: WeatherSim, levelId: number, tick: number, extra: Partial<WeatherStepInput> = {}): boolean {
  return sim.update({
    levelId,
    tick,
    camDx: 0,
    camDy: 0,
    period: PeriodOfDay.Day,
    width: W,
    height: H,
    ...extra,
  })
}

function live<T extends { serial: number }>(records: readonly T[]): Array<{ index: number; rec: T }> {
  const out: Array<{ index: number; rec: T }> = []
  records.forEach((rec, index) => {
    if (rec.serial !== 0) out.push({ index, rec })
  })
  return out
}

/** Step until `pred` holds, failing after `limit` ticks. Returns the last tick used. */
function stepUntil(sim: WeatherSim, levelId: number, fromTick: number, pred: () => boolean, limit = 40000): number {
  let tick = fromTick
  while (!pred()) {
    tick += 1
    if (tick - fromTick > limit) throw new Error('stepUntil: condition never held')
    step(sim, levelId, tick)
  }
  return tick
}

describe('constants and tables', () => {
  it('uses the exact f32 rain speed constants 0x3f59999a / 0x3e19999a', () => {
    const view = new DataView(new ArrayBuffer(4))
    view.setFloat32(0, F32_RAIN_SPEED_BASE, true)
    expect(view.getUint32(0, true)).toBe(0x3f59999a)
    view.setFloat32(0, F32_RAIN_SPEED_INTENSITY, true)
    expect(view.getUint32(0, true)).toBe(0x3e19999a)
  })

  it('maps Act V levels through byte_6fb3167c with an unsigned bound check', () => {
    const cases = Array.from({ length: 13 }, (_, i) => act5WeatherCase(109 + i))
    expect(cases).toEqual([0, 0, 0, 0, 3, 3, 3, 3, 1, 3, 3, 2, 2])
    for (const id of [1, 75, 108, 122, 136]) expect(act5WeatherCase(id)).toBe(3)
  })
})

describe('LoadWeather 0x6fb31750', () => {
  it('runs SelectPrecip(1), then ResetWind once per process, in vanilla RNG order', () => {
    const { sim, rng } = newSim(1)
    const ref = rng.clone()
    load(sim, 1)
    // SelectPrecip(1), not Act V: ResetWind.
    ref.rand(375)
    ref.rand(1500)
    ref.rand(71)
    // First LoadWeather of the process: ResetWind again.
    const angleCountdown = 125 + ref.rand(375)
    const lightCountdown = 500 + ref.rand(1500)
    const angle = 92 + ref.rand(71)
    expect(rng.getSeed()).toEqual(ref.getSeed())
    expect(sim.snapshot()).toMatchObject({
      angle,
      angleTarget: angle,
      angleCountdown,
      lightCountdown,
      firstLoadDone: 1,
      snow: 0,
      forced: 0,
      intensity: 0,
    })

    const ref2 = rng.clone()
    load(sim, 40)
    ref2.rand(375)
    ref2.rand(1500)
    ref2.rand(71)
    expect(rng.getSeed()).toEqual(ref2.getSeed())
  })

  it.each([
    [1, 3000],
    [40, 3000],
    [75, 9000],
    [103, 3000],
    [109, 9000],
  ])('LoadAct level %i sets the full-state base to %i', (levelId, fullBase) => {
    const { sim } = newSim(2)
    load(sim, levelId)
    expect(sim.snapshot().durationBase).toEqual([7500, 250, fullBase, 125])
    expect(sim.snapshot().durationRange).toEqual([7500, 250, 3000, 50])
  })

  it('validates its inputs', () => {
    const { sim } = newSim(3)
    expect(() => sim.loadWeather(1, 1, { colors: { ...COLORS, rainDay: [1, 2] }, frameCounts: FRAMES })).toThrow(
      /12 palette indices/,
    )
    expect(() => sim.loadWeather(1, 1, { colors: COLORS, frameCounts: { ...FRAMES, rain3: 0 } })).toThrow(
      /frame count/,
    )
    expect(() => load(sim, 999)).toThrow(/unknown level/)
    expect(() => step(sim, 1, 1)).toThrow(/before loadWeather/)
  })
})

describe('state machine 0x6fb311f0', () => {
  it('ramps up on the first tick of a fresh process and cycles with 1.13c durations', () => {
    const { sim } = newSim(4)
    load(sim, 1)
    step(sim, 1, 1)
    let s = sim.snapshot()
    expect(s.state).toBe(1)
    expect(s.total).toBeGreaterThanOrEqual(250)
    expect(s.total).toBeLessThanOrEqual(499)
    expect(s.countdown).toBe(s.total - 1)
    expect(s.max).toBeGreaterThanOrEqual(32)
    expect(s.max).toBeLessThanOrEqual(255)
    expect(s.target).toBe(Math.floor(s.max / s.total))

    const ranges: Record<number, [number, number]> = { 0: [7500, 14999], 1: [250, 499], 2: [3000, 5999], 3: [125, 174] }
    const spans: Array<{ state: number; ticks: number; total: number }> = []
    let current = 1
    let startTick = 1
    let startTotal = s.total
    let prevTarget = s.target
    let tick = 1
    while (spans.length < 5) {
      tick += 1
      step(sim, 1, tick)
      s = sim.snapshot()
      if (s.state !== current) {
        spans.push({ state: current, ticks: tick - startTick, total: startTotal })
        current = s.state
        startTick = tick
        startTotal = s.total
      } else if (current === 1) {
        expect(s.target).toBeGreaterThanOrEqual(prevTarget)
      } else if (current === 3) {
        expect(s.target).toBeLessThanOrEqual(prevTarget)
      }
      if (current === 0) expect(s.target).toBe(0)
      if (current === 2) expect(s.target).toBe(s.max)
      // Ramp-down never frees early: drops above the target keep falling until they land (states 3, 0).
      if (current === 1 || current === 2) expect(sim.particles.count).toBe(s.target)
      else expect(sim.particles.count).toBeGreaterThanOrEqual(s.target)
      expect(s.intensity).toBe(s.target / 256)
      prevTarget = s.target
    }
    expect(spans.map((x) => x.state)).toEqual([1, 2, 3, 0, 1])
    for (const span of spans) {
      expect(span.ticks).toBe(span.total)
      const [lo, hi] = ranges[span.state]!
      expect(span.total).toBeGreaterThanOrEqual(lo)
      expect(span.total).toBeLessThanOrEqual(hi)
    }
  })

  it('freezes outside Rain levels, clears particles on the edge and refills to target in one tick', () => {
    const { sim } = newSim(5)
    load(sim, 1)
    let tick = stepUntil(sim, 1, 0, () => sim.snapshot().state === 2)
    tick += 1
    step(sim, 1, tick)
    const before = sim.snapshot()
    expect(sim.particles.count).toBe(before.target)
    for (let i = 0; i < 300; i += 1) {
      tick += 1
      expect(step(sim, 40, tick)).toBe(true)
    }
    const frozen = sim.snapshot()
    expect(frozen.state).toBe(before.state)
    expect(frozen.countdown).toBe(before.countdown)
    expect(frozen.target).toBe(before.target)
    expect(frozen.intensity).toBe(0)
    expect(sim.particles.count).toBe(0)
    tick += 1
    step(sim, 1, tick)
    expect(sim.particles.count).toBe(before.target)
    expect(sim.snapshot().countdown).toBe(before.countdown - 1)
  })

  it('steps at most once per game-frame counter value; a new game resets lastTick only', () => {
    const { sim } = newSim(6)
    load(sim, 1)
    expect(step(sim, 1, 1)).toBe(true)
    expect(step(sim, 1, 1)).toBe(false)
    expect(step(sim, 1, 0)).toBe(false)
    expect(step(sim, 1, 3)).toBe(true)
    const s = sim.snapshot()
    sim.onGameInit()
    expect(sim.snapshot()).toMatchObject({ lastTick: 0, target: 0, state: s.state, countdown: s.countdown })
    expect(sim.particles.count).toBe(0)
    expect(step(sim, 1, 1)).toBe(true)
  })
})

describe('Act V precipitation (SelectPrecip 0x6fb314f0, FullState 0x6fb30ca0)', () => {
  it('always starts snow on act load; 117 big flakes; 120/121 forced 256-flake blizzard; 136 default', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const a = newSim(seed).sim
      load(a, 109)
      expect(a.snapshot()).toMatchObject({ snow: 1, bigFlakes: 0, forced: 0 })
      const b = newSim(seed).sim
      load(b, 117)
      expect(b.snapshot()).toMatchObject({ snow: 1, bigFlakes: 1, forced: 0 })
      for (const id of [120, 121]) {
        const c = newSim(seed).sim
        load(c, 1) // spend the once-per-process ResetWind (see the next test)
        load(c, id)
        expect(c.snapshot()).toMatchObject({
          snow: 1,
          bigFlakes: 1,
          forced: 1,
          state: 2,
          max: 256,
          target: 256,
          angle: 28,
          angleTarget: 28,
          snowAngleBase: 28,
          snowAngleRange: 28,
        })
      }
    }
    const { sim } = newSim(7)
    load(sim, 117)
    load(sim, 136)
    expect(sim.snapshot()).toMatchObject({ snow: 1, bigFlakes: 1, forced: 0 })
  })

  it('the first LoadWeather of a process re-rolls the wind after SelectPrecip, even in the blizzard', () => {
    const { sim } = newSim(24)
    load(sim, 120)
    const s = sim.snapshot()
    expect(s).toMatchObject({ forced: 1, state: 2, max: 256, target: 256 })
    expect(s.angle).toBeGreaterThanOrEqual(92)
    expect(s.angle).toBeLessThanOrEqual(162)
    expect(s.angleTarget).toBe(s.angle)
  })

  it('rolls rain 25% of the time on a 109-112 ramp-up, never on act load or in 117 / 136', () => {
    let rain = 0
    const n = 400
    for (let seed = 0; seed < n; seed += 1) {
      const { sim } = newSim(seed * 7919 + 13)
      load(sim, 110)
      expect(sim.snow).toBe(true)
      step(sim, 110, 1)
      expect(sim.snapshot().state).toBe(1)
      if (!sim.snow) rain += 1
    }
    expect(rain / n).toBeGreaterThan(0.17)
    expect(rain / n).toBeLessThan(0.33)
    for (const id of [117, 136]) {
      for (let seed = 0; seed < 60; seed += 1) {
        const { sim } = newSim(seed)
        load(sim, id)
        step(sim, id, 1)
        expect(sim.snapshot().state).toBe(1)
        expect(sim.snow).toBe(true)
      }
    }
  })

  it.each([
    [109, 87, 42, 170],
    [117, 143, 170, 56],
  ])('FullState in %i re-rolls the peak to 32..%i (snow angle %i + RNG(%i))', (id, hi, base, range) => {
    for (let seed = 0; seed < 12; seed += 1) {
      const { sim } = newSim(seed + 100)
      load(sim, id)
      stepUntil(sim, id, 0, () => sim.snapshot().state === 2)
      const s = sim.snapshot()
      expect(s.max).toBeGreaterThanOrEqual(32)
      expect(s.max).toBeLessThanOrEqual(hi)
      expect(s.target).toBe(s.max)
      expect(s.snowAngleBase).toBe(base)
      expect(s.snowAngleRange).toBe(range)
    }
  })

  it('120/121 keep the forced state; each expiry dips the target to 256·(dur−1)/dur', () => {
    const { sim } = newSim(8)
    load(sim, 120)
    step(sim, 120, 1)
    const s = sim.snapshot()
    expect(s.state).toBe(2)
    expect(s.total).toBeGreaterThanOrEqual(125)
    expect(s.total).toBeLessThanOrEqual(174)
    expect(s.target).toBe(Math.floor((256 * (s.total - 1)) / s.total))
    expect(sim.particles.count).toBe(s.target)
    for (let tick = 2; tick <= s.total; tick += 1) {
      step(sim, 120, tick)
      expect(sim.snapshot().target).toBe(s.target)
      expect(sim.snapshot().state).toBe(2)
    }
    step(sim, 120, s.total + 1)
    const s2 = sim.snapshot()
    expect(s2.state).toBe(2)
    expect(s2.target).toBe(Math.floor((256 * (s2.total - 1)) / s2.total))
  })
})

describe('wind (ResetWind 0x6fb30be0, SpawnAndWind 0x6fb30e30)', () => {
  interface WindSample {
    angle: number
    state: number
    snow: boolean
  }

  /** Primes the once-per-process ResetWind with an Act I load, then loads `id` and steps it. */
  function sweep(id: number, ticks: number, seed = 9): WindSample[] {
    const { sim } = newSim(seed)
    load(sim, 1)
    load(sim, id)
    const out: WindSample[] = [{ angle: sim.angle, state: sim.snapshot().state, snow: sim.snow }]
    for (let tick = 1; tick <= ticks; tick += 1) {
      step(sim, id, tick)
      out.push({ angle: sim.angle, state: sim.snapshot().state, snow: sim.snow })
    }
    return out
  }

  /**
   * Turn-rate check: at most 1 unit per tick for snow, 2 for rain. A ramp-up entry tick is exempt:
   * EnterState(1) → SelectPrecip(0) → ResetWind snaps the angle to a fresh 92..162 roll.
   */
  function expectTurnRate(samples: readonly WindSample[]): { snaps: number; turns: number } {
    let snaps = 0
    let turns = 0
    for (let i = 1; i < samples.length; i += 1) {
      const cur = samples[i]!
      const prev = samples[i - 1]!
      const delta = Math.abs(cur.angle - prev.angle)
      if (cur.state === 1 && prev.state !== 1) {
        snaps += 1
        continue
      }
      expect(delta).toBeLessThanOrEqual(cur.snow ? 1 : 2)
      if (delta !== 0) turns += 1
    }
    return { snaps, turns }
  }

  it('rain targets 92..162, turns 2 units per tick and snaps on each ramp-up', () => {
    const samples = sweep(1, 20000)
    for (const s of samples) {
      expect(s.snow).toBe(false)
      expect(s.angle).toBeGreaterThanOrEqual(92)
      expect(s.angle).toBeLessThanOrEqual(162)
    }
    const { snaps, turns } = expectTurnRate(samples)
    expect(snaps).toBeGreaterThanOrEqual(1)
    expect(turns).toBeGreaterThan(20)
    // Rain turns at full speed: some ticks move exactly 2 units.
    expect(samples.some((s, i) => i > 0 && s.state === samples[i - 1]!.state && Math.abs(s.angle - samples[i - 1]!.angle) === 2)).toBe(true)
  })

  it('the 120 blizzard keeps the wind in 28..55 and snow turns 1 unit per tick', () => {
    const samples = sweep(120, 6000)
    for (const s of samples) {
      expect(s.state).toBe(2)
      expect(s.snow).toBe(true)
      expect(s.angle).toBeGreaterThanOrEqual(28)
      expect(s.angle).toBeLessThanOrEqual(55)
    }
    const { snaps, turns } = expectTurnRate(samples)
    expect(snaps).toBe(0)
    expect(turns).toBeGreaterThan(5)
    expect(new Set(samples.map((s) => s.angle)).size).toBeGreaterThan(5)
  })

  it('109-112 wind stays within 42..211 (snow 42 + RNG(170), rain 92..162)', () => {
    for (const seed of [9, 31, 77]) {
      const samples = sweep(109, 20000, seed)
      for (const s of samples) {
        expect(s.angle).toBeGreaterThanOrEqual(42)
        expect(s.angle).toBeLessThanOrEqual(211)
        if (!s.snow) {
          expect(s.angle).toBeGreaterThanOrEqual(92)
          expect(s.angle).toBeLessThanOrEqual(162)
        }
      }
      expectTurnRate(samples)
    }
  })
})

describe('particles (Spawn 0x6fb30700, Move 0x6fb30f60)', () => {
  it('spawns rain with the vanilla RNG order and formulas', () => {
    const { sim, rng } = newSim(10)
    load(sim, 1)
    sim.setOverride('rain', 1)
    const ref = rng.clone()
    step(sim, 1, 1)
    // StateMachine: countdown 0 → state 3 rolled and refused (forced); then the spawns.
    ref.rand(50)
    const x = ref.rand(W)
    const yEnd = 40 + ref.rand(H - 87)
    const y = -20 + ref.rand(yEnd + 20)
    const phase = ref.step() & 511
    const ci = ref.step() % 12
    expect(sim.particles.records[0]).toMatchObject({ x, yEnd, y, phase, color: COLORS.rainDay[ci], alpha: 0x7f })

    expect(sim.particles.count).toBe(sim.target)
    for (const { rec: p } of live(sim.particles.records)) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThan(W)
      expect(p.yEnd).toBeGreaterThanOrEqual(40)
      expect(p.yEnd).toBeLessThanOrEqual(H - 48)
      expect(p.y).toBeGreaterThanOrEqual(-20)
      expect(p.y).toBeLessThan(p.yEnd)
      const depth = Math.fround((p.yEnd - 40) / (H - 87))
      expect(p.sizeOrLen).toBe(4 + Math.trunc(depth * 8))
      expect(p.speed).toBe(15 + Math.trunc(depth * 15))
      expect(p.landTicks).toBe(3)
      expect(p.landed).toBe(0)
      expect(COLORS.rainDay).toContain(p.color)
    }
  })

  it('spawns snow with one discarded draw and the period colour ramp', () => {
    const { sim, rng } = newSim(11)
    load(sim, 120)
    const ref = rng.clone()
    step(sim, 120, 1, { period: PeriodOfDay.Night })
    ref.rand(50)
    const first = { x: ref.rand(W), yEnd: 40 + ref.rand(H - 87) }
    ref.rand(first.yEnd + 20)
    ref.step()
    ref.step()
    const secondX = ref.rand(W)
    expect(sim.particles.records[0]).toMatchObject(first)
    expect(sim.particles.records[1]!.x).toBe(secondX)
    for (const { rec: p } of live(sim.particles.records)) {
      const depth = Math.fround((p.yEnd - 40) / (H - 87))
      expect(p.speed).toBe(8 + Math.trunc(depth * 28))
      const size = Math.trunc(((p.yEnd - 40) * 7) / (H - 87)) + 1
      expect(p.sizeOrLen).toBe(size)
      const idx = Math.trunc((size * 12) / 8)
      expect(p.color).toBe(COLORS.snowGray[Math.trunc(idx / 4)])
      expect(p.alpha).toBe(80)
      expect(p.landTicks).toBe(1)
    }
  })

  it.each([
    [PeriodOfDay.Dusk, COLORS.rainDuskDawn, 0xff],
    [PeriodOfDay.Night, COLORS.rainNight, 0xff],
    [PeriodOfDay.Dawn, COLORS.rainDuskDawn, 0xff],
  ])('rain spawned in period %i takes its own ramp', (period, table, alpha) => {
    const { sim } = newSim(12)
    load(sim, 1)
    sim.setOverride('rain', 1)
    step(sim, 1, 1, { period })
    for (const { rec: p } of live(sim.particles.records)) {
      expect(table).toContain(p.color)
      expect(p.alpha).toBe(alpha)
    }
  })

  it.each([
    [PeriodOfDay.Day, 1, 200],
    [PeriodOfDay.Dusk, 2, 160],
    [PeriodOfDay.Dawn, 2, 160],
  ])('snow spawned in period %i reads SnowGray[idx / %i] (alpha %i)', (period, div, alpha) => {
    const { sim } = newSim(13)
    load(sim, 120)
    step(sim, 120, 1, { period })
    for (const { rec: p } of live(sim.particles.records)) {
      const idx = Math.trunc((p.sizeOrLen * 12) / 8)
      expect(p.color).toBe(COLORS.snowGray[Math.trunc(idx / div)])
      expect(p.alpha).toBe(alpha)
    }
  })

  it('scrolls x with the camera and wraps once per side (differential run)', () => {
    const a = newSim(14)
    const b = newSim(14)
    for (const { sim } of [a, b]) {
      load(sim, 1)
      sim.setOverride('rain', 1)
    }
    for (let tick = 1; tick <= 40; tick += 1) {
      step(a.sim, 1, tick)
      step(b.sim, 1, tick)
    }
    const camDx = 37
    const serialsBefore = a.sim.particles.records.map((p) => p.serial)
    step(a.sim, 1, 41)
    step(b.sim, 1, 41, { camDx })
    let respawned = 0
    a.sim.particles.records.forEach((pa, i) => {
      const pb = b.sim.particles.records[i]!
      expect(pb.serial).toBe(pa.serial)
      if (pa.serial === 0) return
      expect(pb.x).toBeGreaterThanOrEqual(0)
      expect(pb.x).toBeLessThan(W)
      expect((((pa.x - pb.x - camDx) % W) + W) % W).toBe(0)
      if (pa.serial !== serialsBefore[i]) respawned += 1
    })
    // Slot-reuse quirk: a drop respawned into its own slot still takes this tick's horizontal step.
    expect(respawned).toBeGreaterThan(0)
  })

  it('scrolls y with the camera (differential run)', () => {
    const a = newSim(15)
    const b = newSim(15)
    for (const { sim } of [a, b]) {
      load(sim, 1)
      sim.setOverride('rain', 1)
    }
    for (let tick = 1; tick <= 40; tick += 1) {
      step(a.sim, 1, tick)
      step(b.sim, 1, tick)
    }
    const before = a.sim.particles.records.map((p) => p.serial)
    step(a.sim, 1, 41)
    step(b.sim, 1, 41, { camDy: 3 })
    let compared = 0
    a.sim.particles.records.forEach((pa, i) => {
      const pb = b.sim.particles.records[i]!
      if (pa.serial === 0 || pa.serial !== before[i] || pb.serial !== before[i]) return
      if (pa.landed || pb.landed) return
      expect(pb.y).toBe(pa.y - 3)
      compared += 1
    })
    expect(compared).toBeGreaterThan(20)
  })

  it.each([
    ['rain', 1, 3],
    ['snow', 120, 1],
  ] as const)('a landed %s particle stays put for %i tick(s), then its slot is freed', (_kind, id, linger) => {
    const { sim } = newSim(16)
    load(sim, id)
    if (id === 1) sim.setOverride('rain', 1)
    step(sim, id, 1)
    const slot = 0
    const serial = sim.particles.records[slot]!.serial
    let tick = stepUntil(sim, id, 1, () => sim.particles.records[slot]!.landed === 1, 200)
    const p = sim.particles.records[slot]!
    expect(p.serial).toBe(serial)
    const at = { x: p.x, y: p.y }
    for (let k = 1; k < linger; k += 1) {
      tick += 1
      step(sim, id, tick)
      expect(p.serial).toBe(serial)
      expect(p.landed).toBe(1)
      expect(p.speed).toBe(0)
      expect({ x: p.x, y: p.y }).toEqual(at)
    }
    tick += 1
    step(sim, id, tick)
    expect(p.serial === 0 || p.serial !== serial).toBe(true)
  })
})

describe('splashes and bubbles (0x6fac4050, 0x6fb30a70, 0x6fb30940, 0x6fb30160, 0x6fb300d0)', () => {
  const tile = { sx: 400, sy: 300 }
  const tiles = Array.from({ length: 200 }, () => tile)

  function rowHalfWidth(r: number): number {
    return 80 - 2 * Math.abs(r - 40)
  }

  it('spawns inside the tile diamond and lives 2 ticks per frame (splash 20, bubble 24)', () => {
    const { sim } = newSim(17)
    load(sim, 75)
    sim.setOverride('rain', 75)
    for (let tick = 1; tick <= 30; tick += 1) step(sim, 75, tick)
    sim.floorPass(tiles, 30, true)
    const splashes = live(sim.splashes.records)
    const bubbles = live(sim.bubbles.records)
    const chance = Math.trunc(sim.intensity * 1000)
    expect(chance).toBeGreaterThan(0)
    expect(splashes.length).toBeGreaterThan(0)
    expect(bubbles.length).toBeGreaterThan(0)
    for (const { rec: o } of splashes) {
      const r = o.y - tile.sy
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThan(80)
      const w = rowHalfWidth(r)
      expect(o.x - tile.sx).toBeGreaterThanOrEqual(-w)
      expect(o.x - tile.sx).toBeLessThanOrEqual(w === 0 ? 0 : w - 1)
      expect([2, 3]).toContain(o.type)
      expect(o).toMatchObject({ frame: 0, delay: 2 })
    }
    for (const { rec: o } of bubbles) {
      const r = o.y + 30 - tile.sy
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThan(80)
      expect(o).toMatchObject({ type: 2, frame: 0, delay: 2 })
    }
    const splashSerials = splashes.map((s) => s.rec.serial)
    const bubbleSerials = bubbles.map((s) => s.rec.serial)
    for (let k = 1; k <= 24; k += 1) {
      step(sim, 75, 30 + k)
      const splashAlive = splashes.filter((s, i) => s.rec.serial === splashSerials[i]).length
      const bubbleAlive = bubbles.filter((s, i) => s.rec.serial === bubbleSerials[i]).length
      expect(splashAlive).toBe(k < 20 ? splashes.length : 0)
      expect(bubbleAlive).toBe(k < 24 ? bubbles.length : 0)
    }
  })

  it('draws one RNG(1000) per water tile even when nothing can spawn', () => {
    const { sim, rng } = newSim(18)
    load(sim, 75)
    sim.floorPass(tiles.slice(0, 7), 2, true)
    const ref = rng.clone()
    sim.floorPass(tiles.slice(0, 7), 3, true)
    for (let i = 0; i < 7; i += 1) ref.rand(1000)
    expect(rng.getSeed()).toEqual(ref.getSeed())
    expect(sim.splashes.count).toBe(0)
  })

  it('gates splashes to every 4th tick and bubbles to every 26th; the stamps survive a new game', () => {
    const { sim } = newSim(19)
    load(sim, 75)
    sim.floorPass([], 5000, true)
    expect(sim.snapshot()).toMatchObject({ lastSplashTick: 5000, lastBubbleTick: 5000 })
    sim.floorPass([], 5003, true)
    expect(sim.snapshot().lastSplashTick).toBe(5000)
    sim.floorPass([], 5004, true)
    expect(sim.snapshot().lastSplashTick).toBe(5004)
    expect(sim.snapshot().lastBubbleTick).toBe(5000)
    sim.onGameInit()
    sim.floorPass(tiles, 100, true)
    expect(sim.bubbles.count).toBe(0)
    expect(sim.snapshot()).toMatchObject({ lastSplashTick: 5004, lastBubbleTick: 5000 })
    sim.floorPass(tiles, 5026, true)
    expect(sim.snapshot().lastBubbleTick).toBe(5026)
    expect(sim.bubbles.count).toBeGreaterThan(0)
  })

  it('clears splashes and particles when leaving a Rain level, bubbles when leaving a Mud level', () => {
    const { sim } = newSim(20)
    load(sim, 75)
    sim.setOverride('rain', 75)
    for (let tick = 1; tick <= 30; tick += 1) step(sim, 75, tick)
    sim.floorPass(tiles, 30, true)
    expect(sim.splashes.count).toBeGreaterThan(0)
    expect(sim.bubbles.count).toBeGreaterThan(0)
    sim.setOverride('off', 75)
    step(sim, 40, 31)
    expect(sim.particles.count).toBe(0)
    expect(sim.splashes.count).toBe(0)
    expect(sim.bubbles.count).toBe(0)
  })
})

describe('local reassign 0x6fb31720 and the override', () => {
  it('reassign clears overlays and re-runs SelectPrecip(arg) only for a non-zero arg', () => {
    const { sim } = newSim(21)
    load(sim, 109)
    expect(sim.snapshot()).toMatchObject({ snow: 1, forced: 0 })
    sim.onLocalReassign(0, 121)
    expect(sim.snapshot().forced).toBe(0)
    sim.onLocalReassign(1, 121)
    expect(sim.snapshot()).toMatchObject({ forced: 1, state: 2, max: 256, target: 256, angle: 28, bigFlakes: 1 })
    sim.onLocalReassign(1, 109)
    expect(sim.snapshot()).toMatchObject({ forced: 0, bigFlakes: 0, snow: 1 })
    sim.onLocalReassign(1, 1)
    expect(sim.snapshot()).toMatchObject({ forced: 0, snow: 0 })
  })

  it('override rain / snow forces precipitation in any level; off resumes 1.13c behaviour', () => {
    const { sim } = newSim(22)
    sim.setOverride('snow', 40)
    expect(sim.override).toBe('snow')
    load(sim, 40)
    expect(sim.snapshot()).toMatchObject({ snow: 1, forced: 1, state: 2 })
    step(sim, 40, 1)
    expect(sim.particles.count).toBeGreaterThan(0)
    for (const { rec: p } of live(sim.particles.records)) expect(p.landTicks).toBe(1)

    sim.setOverride('rain', 40)
    expect(sim.snapshot()).toMatchObject({ snow: 0, forced: 1, state: 2 })
    expect(sim.particles.count).toBe(0)
    step(sim, 40, 2)
    expect(sim.particles.count).toBe(sim.target)
    for (const { rec: p } of live(sim.particles.records)) expect(p.landTicks).toBe(3)
    expect(sim.isPrecipitationLevel(40)).toBe(true)

    sim.setOverride('off', 40)
    expect(sim.snapshot().forced).toBe(0)
    expect(sim.isPrecipitationLevel(40)).toBe(false)
    step(sim, 40, 3)
    expect(sim.particles.count).toBe(0)
    expect(sim.intensity).toBe(0)
    expect(() => sim.setOverride('hail' as never, 40)).toThrow(/unknown override/)
  })

  it('override keeps the full state through ramp-down expiries (EnterState refuses while forced)', () => {
    const { sim } = newSim(23)
    load(sim, 1)
    sim.setOverride('rain', 1)
    for (let tick = 1; tick <= 1500; tick += 1) {
      step(sim, 1, tick)
      expect(sim.snapshot().state).toBe(2)
    }
    expect(sim.particles.count).toBeGreaterThan(0)
  })
})
