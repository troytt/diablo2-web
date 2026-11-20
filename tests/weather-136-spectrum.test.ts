/**
 * 136-level weather spectrum (1.13c): which levels rain, snow, bubble or stay dry. Checked against
 * Patch_D2.mpq Levels.txt (`Act`, `Rain`, `Mud`) for every level id 1..136, then run through the
 * client weather simulation (src/client/weather/weather-sim.ts).
 *
 * Ground truth: D2Client 0x6fb31340 reads Levels.txt Rain / Mud of the player's level through
 * D2Common #10215 / #10499; SelectPrecip 0x6fb314f0 and FullState 0x6fb30ca0 pick the Act V snow
 * flavour from byte_6fb3167c (levels 109..121, everything else takes the default case).
 */

import { existsSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { fileSource } from '../src/baker/io/file-source.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { D2Rng } from '../src/common/rng/d2-rng.ts'
import { cell, parseTable, type D2Table } from '../src/common/world/acts.ts'
import { PeriodOfDay } from '../src/common/world/environment.ts'
import { getLevelLighting } from '../src/common/world/levels-meta.ts'
import { WeatherSim, type WeatherLevelInfo } from '../src/client/weather/weather-sim.ts'

/** 'bubbles only' (Mud without Rain) does not occur in 1.13c; it is listed so the audit can report it. */
type Mode = 'none' | 'bubbles only' | 'rain' | 'rain+bubbles' | 'small snow' | 'big snow' | 'blizzard' | 'default snow'

const range = (lo: number, hi: number): number[] => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)

/** The 1.13c weather modes. Every level id 1..136 not listed here is dry. */
const EXPECTED: Readonly<Record<Exclude<Mode, 'none' | 'bubbles only'>, readonly number[]>> = {
  rain: [...range(1, 7), 17, 38, 39],
  'rain+bubbles': range(75, 83),
  'small snow': range(109, 112),
  'big snow': [117],
  blizzard: [120, 121],
  'default snow': [136],
}

interface LevelsRow {
  readonly id: number
  readonly name: string
  readonly act: number
  readonly rain: boolean
  readonly mud: boolean
}

const W = 800
const H = 600
const RAMP = (start: number): number[] => Array.from({ length: 12 }, (_, i) => start + i)
const LOAD_INPUT = {
  colors: { rainDay: RAMP(10), rainDuskDawn: RAMP(30), rainNight: RAMP(50), snowGray: RAMP(70) },
  frameCounts: { rain3: 10, rain4: 10, bubble3: 12 },
}
/** 200 water tiles: a 10% bubble roll misses all of them with probability 0.9^200 ≈ 7e-10. */
const WATER_TILES = Array.from({ length: 200 }, (_, i) => ({ sx: 80 + (i % 8) * 80, sy: 60 + Math.floor(i / 8) * 20 }))

describe('136-level weather spectrum vs 1.13c Levels.txt', () => {
  let byId: ReadonlyMap<number, LevelsRow>

  beforeAll(async () => {
    const dir = existsSync('samples/d2/Patch_D2.mpq') ? 'samples/d2' : (process.env.D2_DATA_DIR ?? 'samples/d2')
    const archives = new MountedArchives()
    for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
      archives.add(name, await MpqArchive.open(await fileSource(`${dir}/${name}`)))
    }
    const table: D2Table = parseTable(await archives.read('data\\global\\excel\\Levels.txt'))
    const rows = new Map<number, LevelsRow>()
    for (const raw of table.rows) {
      const idText = cell(table, raw, 'Id').trim()
      if (idText === '') continue
      const num = (column: string): number => Number(cell(table, raw, column).trim() || '0')
      const id = Number(idText)
      if (rows.has(id)) throw new Error(`Levels.txt has two rows for level ${String(id)}`)
      rows.set(id, {
        id,
        name: cell(table, raw, 'Name').trim(),
        act: num('Act') + 1,
        rain: num('Rain') !== 0,
        mud: num('Mud') !== 0,
      })
    }
    byId = rows
  })

  /** Levels.txt as the weather reads it (D2Common #10459 / #10215 / #10499). */
  function levels(id: number): WeatherLevelInfo {
    const row = byId.get(id)
    if (row === undefined) throw new Error(`Levels.txt has no level ${String(id)}`)
    return { act: row.act, rain: row.rain, mud: row.mud }
  }

  /**
   * Runs one level the way the client meets it: an act load of the level itself after a prior
   * Frozen Tundra act load (that spends the once-per-process ResetWind and sets bigFlakes = 1, so the
   * Act V cases that clear / keep it show), then up to 600 ticks until the full state, then a floor
   * pass over water tiles with the level's own Mud flag.
   */
  function observe(id: number, seed: number): Mode {
    const rng = new D2Rng((seed * 2654435761) >>> 0, 0x5eed)
    const sim = new WeatherSim({ rng, levels })
    sim.onGameInit()
    sim.loadWeather(117, 117, LOAD_INPUT)
    sim.loadWeather(id, id, LOAD_INPUT)
    const loaded = sim.snapshot()
    let tick = 0
    while (tick < 600) {
      tick += 1
      sim.update({ levelId: id, tick, camDx: 0, camDy: 0, period: PeriodOfDay.Day, width: W, height: H })
      if (sim.snapshot().state === 2 && tick >= 30) break
    }
    const full = sim.snapshot()
    sim.floorPass(WATER_TILES, tick + 26, levels(id).mud)
    const bubbles = sim.bubbles.count
    tick += 1
    sim.update({ levelId: id, tick, camDx: 0, camDy: 0, period: PeriodOfDay.Day, width: W, height: H })

    if (sim.particles.count === 0) {
      expect(full.state, `level ${id}: dry levels never run the state machine`).toBe(0)
      expect(full.intensity).toBe(0)
      expect(sim.splashes.count).toBe(0)
      return bubbles > 0 ? 'bubbles only' : 'none'
    }
    expect(full.state, `level ${id}`).toBe(2)
    if (loaded.snow === 0) return bubbles > 0 ? 'rain+bubbles' : 'rain'
    expect(bubbles, `level ${id}: no Act V level has Mud`).toBe(0)
    if (full.forced) {
      expect(full).toMatchObject({ max: 256, snowAngleBase: 28, snowAngleRange: 28 })
      // Each countdown expiry dips the target once (EnterState(3) refused, ramp-down formula applied).
      expect([256, Math.floor((256 * (full.total - 1)) / full.total)]).toContain(full.target)
      return 'blizzard'
    }
    if (full.bigFlakes === 0) {
      expect(full).toMatchObject({ snowAngleBase: 42, snowAngleRange: 170 })
      expect(full.max).toBeLessThanOrEqual(87)
      return 'small snow'
    }
    if (full.snowAngleBase === 170) {
      expect(full.snowAngleRange).toBe(56)
      expect(full.max).toBeLessThanOrEqual(143)
      return 'big snow'
    }
    // Default case: FullState keeps the ramp-up peak and the game-init snow angle pair.
    expect(full).toMatchObject({ snowAngleBase: 42, snowAngleRange: 170 })
    return 'default snow'
  }

  it('has a Levels.txt row for every level 1..136', () => {
    for (let id = 1; id <= 136; id++) expect(byId.has(id), `level ${String(id)}`).toBe(true)
  })

  it('the baked levels-meta Act / Rain / Mud match Levels.txt for all 136 levels', () => {
    for (let id = 1; id <= 136; id++) {
      const row = byId.get(id)!
      const meta = getLevelLighting(id)
      expect(meta, `level ${String(id)}`).toBeDefined()
      expect({ act: meta!.act, rain: meta!.rain, mud: meta!.mud }, `level ${String(id)} ${row.name}`).toEqual({
        act: row.act,
        rain: row.rain,
        mud: row.mud,
      })
    }
  })

  it('Rain is set on 27 levels and Mud only on the Kurast levels 75..83', () => {
    const rain = range(1, 136).filter((id) => byId.get(id)!.rain)
    const mud = range(1, 136).filter((id) => byId.get(id)!.mud)
    expect(rain).toEqual([...range(1, 7), 17, 38, 39, ...range(75, 83), ...range(109, 112), 117, 120, 121, 136])
    expect(mud).toEqual(range(75, 83))
  })

  it('every level 1..136 shows its 1.13c weather mode in the simulation', () => {
    const expected = new Map<number, Mode>()
    for (const [mode, ids] of Object.entries(EXPECTED) as Array<[Mode, readonly number[]]>) {
      for (const id of ids) expected.set(id, mode)
    }
    const got: Array<[number, Mode]> = []
    const want: Array<[number, Mode]> = []
    for (let id = 1; id <= 136; id++) {
      for (const seed of [1, 2, 3]) {
        got.push([id, observe(id, seed * 1000 + id)])
        want.push([id, expected.get(id) ?? 'none'])
      }
    }
    expect(got).toEqual(want)
  })

  it('Act V levels without Rain still flip the snow flag on act load but draw nothing', () => {
    for (const id of range(109, 136).filter((x) => !byId.get(x)!.rain)) {
      const sim = new WeatherSim({ rng: new D2Rng(id, 0x5eed), levels })
      sim.onGameInit()
      sim.loadWeather(1, 1, LOAD_INPUT)
      sim.loadWeather(id, id, LOAD_INPUT)
      expect(sim.snow, `level ${id}`).toBe(true)
      for (let tick = 1; tick <= 50; tick++) {
        sim.update({ levelId: id, tick, camDx: 0, camDy: 0, period: PeriodOfDay.Night, width: W, height: H })
      }
      expect(sim.particles.count, `level ${id}`).toBe(0)
      expect(sim.intensity).toBe(0)
    }
  })
})
