/**
 * Diablo II v1.13c act environment clock (D2Common `D2DrlgEnvironmentStrc`), checked against
 * golden numbers from an independent reference model of the 1.13c disassembly
 * (UpdateTicks 0x6fd87570, UpdateLightIntensity 0x6fd876f0, UpdateLightColor 0x6fd871c0,
 * ENVIRONMENT_Alloc 0x6fd87ba0, InitializeEnvironment #10358 0x6fd87920).
 */

import { describe, expect, it } from 'vitest'
import {
  ENV_TIME_RATE,
  EnvCycleIndex,
  Environment,
  PeriodOfDay,
} from '../src/common/world/environment.ts'

type EnvState = readonly [cycle: number, period: number, ticks: number, intensity: number, r: number, g: number, b: number]

function stateOf(env: Environment): EnvState {
  return [env.cycleIndex, env.period, env.ticks, env.intensity, env.red, env.green, env.blue]
}

interface DayRun {
  /** `[frame, cycleIndex, ticks]` of every cycle change. */
  readonly transitions: (readonly [number, number, number])[]
  /** Frames on which `updatePeriodOfDay` reported a period change. */
  readonly periodChanges: number[]
  readonly probes: Map<number, EnvState>
  /** First frame that brought the clock back to its starting cycle and ticks. */
  readonly length: number | null
}

/** Run the 25 Hz update from ENVIRONMENT_Alloc for up to `maxFrames` frames. */
function runDay(levelId: number, maxFrames: number, probeFrames: readonly number[] = []): DayRun {
  const env = Environment.alloc()
  const start = [env.cycleIndex, env.ticks] as const
  const probeSet = new Set(probeFrames)
  const transitions: (readonly [number, number, number])[] = []
  const periodChanges: number[] = []
  const probes = new Map<number, EnvState>()
  let length: number | null = null
  for (let frame = 1; frame <= maxFrames; frame += 1) {
    const prevCycle = env.cycleIndex
    if (env.updatePeriodOfDay(levelId)) periodChanges.push(frame)
    if (env.cycleIndex !== prevCycle) transitions.push([frame, env.cycleIndex, env.ticks])
    if (probeSet.has(frame)) probes.set(frame, stateOf(env))
    if (length === null && env.cycleIndex === start[0] && env.ticks === start[1]) length = frame
  }
  return { transitions, periodChanges, probes, length }
}

describe('ENVIRONMENT_Alloc (0x6fd87ba0)', () => {
  it('starts at noon: cycle 2, Day, ticks 0, intensity 128, white light, no eclipse', () => {
    const env = Environment.alloc()
    expect(stateOf(env)).toEqual([EnvCycleIndex.Noon, PeriodOfDay.Day, 0, 128, 255, 255, 255])
    expect(env.eclipse).toBe(false)
    expect(env.rate).toBe(ENV_TIME_RATE)
    expect(ENV_TIME_RATE).toBe(128)
  })
})

describe('ENVIRONMENT_UpdatePeriodOfDay (#10135) day lengths', () => {
  it('Act I: a day is 35,846 frames with the 1.13c cycle transitions', () => {
    const run = runDay(2, 35_846, [1, 21_761, 24_322, 34_564, 35_844, 35_845, 35_846])
    expect(run.length).toBe(35_846)
    expect(run.transitions).toEqual([
      [20_481, 3, 20_480],
      [23_042, 4, 23_040],
      [25_603, 5, 25_600],
      [33_284, 0, 40_960],
      [35_845, 1, 43_520],
      [35_846, 2, 0],
    ])
    // Day→Dusk, Dusk→Night, Night→Dawn, Dawn→Day; 3→4 and 0→1 stay in the same period.
    expect(run.periodChanges).toEqual([20_481, 25_603, 33_284, 35_846])
    expect(run.probes.get(1)).toEqual([2, PeriodOfDay.Day, 1, 128, 255, 255, 255])
    expect(run.probes.get(21_761)).toEqual([3, PeriodOfDay.Dusk, 21_760, 150, 225, 204, 225])
    expect(run.probes.get(24_322)).toEqual([4, PeriodOfDay.Dusk, 24_320, 117, 160, 149, 218])
    expect(run.probes.get(34_564)).toEqual([0, PeriodOfDay.Dawn, 42_240, 96, 167, 164, 188])
    // The 340° "morning" row lasts exactly one frame, and sunrise jumps from warm I=106 to white I=128.
    expect(run.probes.get(35_844)).toEqual([0, PeriodOfDay.Dawn, 43_520, 106, 208, 184, 132])
    expect(run.probes.get(35_845)).toEqual([1, PeriodOfDay.Dawn, 43_520, 106, 208, 184, 131])
    expect(run.probes.get(35_846)).toEqual([2, PeriodOfDay.Day, 0, 128, 255, 255, 255])
  })

  it('Act III nights run 9 ticks per frame: a day is 29,702 frames', () => {
    const run = runDay(76, 29_702)
    expect(run.length).toBe(29_702)
    expect(run.transitions).toEqual([
      [20_481, 3, 20_480],
      [23_042, 4, 23_040],
      [25_603, 5, 25_600],
      [27_140, 0, 40_960],
      [29_701, 1, 43_520],
      [29_702, 2, 0],
    ])
  })

  it('Act IV adds 15 ticks per frame (2,726-frame day), steps intensity 1 per frame toward its target and byte-wraps colours', () => {
    const run = runDay(104, 2_726, [1, 64, 65, 1_281, 1_442, 1_603, 2_564, 2_725, 2_726])
    expect(run.length).toBe(2_726)
    expect(run.transitions).toEqual([
      [1_281, 3, 20_480],
      [1_442, 4, 23_040],
      [1_603, 5, 25_600],
      [2_564, 0, 40_960],
      [2_725, 1, 43_520],
      [2_726, 2, 0],
    ])
    expect(run.probes.get(1)).toEqual([2, PeriodOfDay.Day, 16, 127, 255, 20, 20])
    expect(run.probes.get(64)).toEqual([2, PeriodOfDay.Day, 1_024, 64, 255, 30, 20])
    expect(run.probes.get(65)).toEqual([2, PeriodOfDay.Day, 1_040, 64, 255, 31, 20])
    // Normal-table cycle positions against the Act IV colour rows: ratio -2, channels wrap to a byte.
    expect(run.probes.get(1_281)).toEqual([3, PeriodOfDay.Dusk, 20_480, 64, 213, 205, 217])
    expect(run.probes.get(1_442)).toEqual([4, PeriodOfDay.Dusk, 23_040, 64, 172, 160, 144])
    expect(run.probes.get(1_603)).toEqual([5, PeriodOfDay.Night, 25_600, 64, 125, 144, 243])
    expect(run.probes.get(2_564)).toEqual([0, PeriodOfDay.Dawn, 40_960, 64, 57, 99, 211])
    expect(run.probes.get(2_725)).toEqual([1, PeriodOfDay.Dawn, 43_520, 64, 209, 180, 129])
    expect(run.probes.get(2_726)).toEqual([2, PeriodOfDay.Day, 0, 64, 255, 20, 20])

    const env = Environment.alloc()
    for (let i = 0; i < 5; i += 1) env.updatePeriodOfDay(107) // other Act IV levels aim at 16
    expect(env.intensity).toBe(123)
    for (let i = 0; i < 300; i += 1) env.updatePeriodOfDay(103) // Pandemonium Fortress aims at 128
    expect(env.intensity).toBe(128)
  })

  it('Act V caps the intensity at 170; Arreat Summit (120) is fixed at 200 with colour 245,240,255', () => {
    const actV = runDay(110, 21_761, [1, 2_000, 21_761])
    expect(actV.probes.get(1)).toEqual([2, PeriodOfDay.Day, 1, 128, 255, 255, 255])
    expect(actV.probes.get(2_000)).toEqual([2, PeriodOfDay.Day, 2_000, 162, 255, 255, 255])
    expect(actV.probes.get(21_761)).toEqual([3, PeriodOfDay.Dusk, 21_760, 150, 225, 204, 225])

    const summit = runDay(120, 30_000, [1, 21_761, 30_000])
    expect(summit.probes.get(1)).toEqual([2, PeriodOfDay.Day, 1, 200, 245, 240, 255])
    expect(summit.probes.get(21_761)).toEqual([3, PeriodOfDay.Dusk, 21_760, 200, 245, 240, 255])
    expect(summit.probes.get(30_000)).toEqual([5, PeriodOfDay.Night, 34_394, 200, 245, 240, 255])
  })
})

describe('ENVIRONMENT_UpdateLightIntensity (0x6fd876f0) sine curve', () => {
  // [degrees, cycle row, Act I intensity, Act V intensity]
  const SAMPLES: readonly (readonly [number, number, number, number])[] = [
    [0, 2, 128, 128],
    [45, 2, 219, 170],
    [90, 2, 255, 170],
    [135, 2, 219, 170],
    [160, 3, 172, 170],
    [179, 3, 130, 130],
    [180, 4, 128, 128],
    [200, 5, 106, 106],
    [270, 5, 64, 64],
    [320, 0, 87, 87],
    [340, 1, 106, 106],
  ]

  it.each(SAMPLES)('%i° (row %i): Act I %i, Act V %i (f32 sine, half amplitude at night)', (deg, cycle, actI, actV) => {
    const env = Environment.alloc()
    env.initialize(2, cycle, deg * ENV_TIME_RATE, false)
    expect(env.intensity).toBe(actI)
    const envV = Environment.alloc()
    envV.initialize(110, cycle, deg * ENV_TIME_RATE, false)
    expect(envV.intensity).toBe(actV)
  })
})

describe('ENVIRONMENT_InitializeEnvironment (#10358)', () => {
  it('applies cycle, ticks and period; the non-eclipse path leaves the colour to the next frame', () => {
    const env = Environment.alloc()
    env.initialize(2, EnvCycleIndex.Night, 260 * ENV_TIME_RATE, false)
    expect(env.cycleIndex).toBe(EnvCycleIndex.Night)
    expect(env.period).toBe(PeriodOfDay.Night)
    expect(env.ticks).toBe(260 * ENV_TIME_RATE)
    expect(env.intensity).toBe(65)
    expect([env.red, env.green, env.blue]).toEqual([255, 255, 255])
    env.updatePeriodOfDay(2)
    expect([env.red, env.green, env.blue]).toEqual([125, 144, 243])
  })

  it('drops tick counts above 360° to 0 and rejects invalid cycles and negative ticks', () => {
    const env = Environment.alloc()
    env.initialize(2, EnvCycleIndex.Noon, 360 * ENV_TIME_RATE + 1, false)
    expect(env.ticks).toBe(0)
    env.initialize(2, EnvCycleIndex.Noon, 360 * ENV_TIME_RATE, false)
    expect(env.ticks).toBe(360 * ENV_TIME_RATE)
    expect(() => env.initialize(2, 6, 0, false)).toThrow(RangeError)
    expect(() => env.initialize(2, -1, 0, false)).toThrow(RangeError)
    expect(() => env.initialize(2, 1.5, 0, false)).toThrow(RangeError)
    expect(() => env.initialize(2, 2, -1, false)).toThrow(RangeError)
  })

  it('eclipse: snaps to the eclipse row, decays the intensity by 8 per frame down to 32 and uses the eclipse colours', () => {
    const env = Environment.alloc()
    env.initialize(2, 3, 0, true)
    expect(env.eclipse).toBe(true)
    expect(env.period).toBe(PeriodOfDay.Night)
    expect(env.ticks).toBe(120 * ENV_TIME_RATE)
    expect([env.red, env.green, env.blue]).toEqual([0, 30, 243])
    const decay = [env.intensity]
    for (let i = 0; i < 15; i += 1) {
      env.updatePeriodOfDay(2)
      decay.push(env.intensity)
    }
    expect(decay).toEqual([120, 112, 104, 96, 88, 80, 72, 64, 56, 48, 40, 32, 32, 32, 32, 32])
    // Eclipse ticks advance by exactly 1 per frame, whatever the period or act.
    expect(env.ticks).toBe(120 * ENV_TIME_RATE + 15)
  })

  it('computes the first intensity with the previous eclipse flag (0x6fd879e6)', () => {
    const env = Environment.alloc()
    env.initialize(2, 3, 0, true)
    for (let i = 0; i < 20; i += 1) env.updatePeriodOfDay(2)
    expect(env.intensity).toBe(32)
    env.initialize(2, EnvCycleIndex.Noon, 0, false)
    expect(env.eclipse).toBe(false)
    expect(env.intensity).toBe(32) // eclipse decay path, not the noon sine
    env.updatePeriodOfDay(2)
    expect(env.intensity).toBe(128)
  })

  it('Arreat Summit (120): intensity 200 and colour 245,240,255 right after the sync', () => {
    const env = Environment.alloc()
    env.initialize(120, EnvCycleIndex.Night, 250 * ENV_TIME_RATE, false)
    expect([env.intensity, env.red, env.green, env.blue]).toEqual([200, 245, 240, 255])
  })
})
