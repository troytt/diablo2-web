/**
 * WeatherController (src/client/weather/weather-controller.ts): the LoadWeather queue (0x6fb714f0),
 * game init, the per-frame update with step-origin camera accumulation, and the floor-pass tile
 * filter (0x6fac3ce0: drawn, orientation 0, DT1 material bit 0x02).
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import { PeriodOfDay } from '../../src/common/world/environment.ts'
import {
  DT1_MATERIAL_WATER,
  FLOOR_TILE_HALF_WIDTH,
  WeatherController,
  localReassignWeatherArg113c,
  weatherLevelInfo113c,
  type WeatherFloorTile,
  type WeatherFrameInput,
} from '../../src/client/weather/weather-controller.ts'
import { loadWeatherManifest } from './weather-golden-scenes.ts'

function newController(seed = 1): WeatherController {
  const c = new WeatherController({ rng: new D2Rng(seed, 0x5eed) })
  c.onGameInit()
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

afterEach(() => {
  vi.restoreAllMocks()
})

describe('WeatherController lifecycle', () => {
  it('queues LoadWeather until the assets are installed, then loads the LoadAct act palette', () => {
    const data = loadWeatherManifest()
    const c = newController()
    c.onLoadAct(1)
    expect(c.beginFrame(frame())).toBe(false)
    expect(c.active).toBe(false)
    expect(() => c.palette).toThrow(/before LoadWeather/)

    c.setAssets(data)
    expect(c.beginFrame(frame({ tick: 2 }))).toBe(true)
    expect(c.active).toBe(true)
    expect(c.sim.isLoaded).toBe(true)
    expect(c.palette).toBe(data.palettes[0])

    // A later act load swaps the palette (Harrogath → Act V).
    c.onLoadAct(109)
    expect(c.beginFrame(frame({ levelId: 109, tick: 3 }))).toBe(true)
    expect(c.palette).toBe(data.palettes[4])
  })

  it('keeps the weather off after game init until the next act load', () => {
    const c = newController()
    c.setAssets(loadWeatherManifest())
    c.onLoadAct(1)
    expect(c.beginFrame(frame({ tick: 1 }))).toBe(true)
    c.onGameInit()
    expect(c.beginFrame(frame({ tick: 2 }))).toBe(false)
    expect(c.active).toBe(false)
    c.onLoadAct(1)
    expect(c.beginFrame(frame({ tick: 3 }))).toBe(true)
  })

  it('fails fast on misuse', () => {
    const c = newController()
    c.setAssets(loadWeatherManifest())
    expect(() => c.setAssets(loadWeatherManifest())).toThrow(/twice/)
    expect(() => c.onLoadAct(9999)).toThrow(/no level 9999/)
    expect(() => c.onLoadAct(1.5)).toThrow(/onLoadAct/)
    expect(() => weatherLevelInfo113c(0)).toThrow(/no level 0/)
  })

  it('forwards local reassigns and the override with the player level', () => {
    const c = newController()
    c.setAssets(loadWeatherManifest())
    c.setOverride('snow')
    expect(c.override).toBe('snow')
    c.onLoadAct(1)
    c.beginFrame(frame({ tick: 1 }))
    expect(c.sim.override).toBe('snow')
    expect(c.sim.snow).toBe(true)
    expect(c.sim.isPrecipitationLevel(2)).toBe(true)

    const reassign = vi.spyOn(c.sim, 'onLocalReassign')
    c.onLocalReassign(1)
    expect(reassign).not.toHaveBeenCalled()
    c.beginFrame(frame({ levelId: 3, tick: 2 }))
    expect(reassign).toHaveBeenCalledWith(1, 3)

    c.setOverride('off')
    expect(c.sim.override).toBe('off')
    expect(c.sim.snow).toBe(false)
  })

  it('runs queued local reassigns in arrival order at the next frame, before the pending LoadWeather', () => {
    const c = newController()
    c.setAssets(loadWeatherManifest())
    c.onLoadAct(1)
    const reassign = vi.spyOn(c.sim, 'onLocalReassign')
    const load = vi.spyOn(c.sim, 'loadWeather')
    c.onLocalReassign(1)
    c.onLocalReassign(0)
    expect(reassign).not.toHaveBeenCalled()

    c.beginFrame(frame({ levelId: 3, tick: 1 }))
    expect(reassign.mock.calls).toEqual([
      [1, 3],
      [0, 3],
    ])
    expect(load).toHaveBeenCalledTimes(1)
    expect(load.mock.calls[0]![0]).toBe(1)
    expect(load.mock.calls[0]![1]).toBe(3)
    expect(reassign.mock.invocationCallOrder[1]!).toBeLessThan(load.mock.invocationCallOrder[0]!)

    // The queue is drained.
    c.beginFrame(frame({ levelId: 3, tick: 2 }))
    expect(reassign).toHaveBeenCalledTimes(2)
  })

  it('drops queued local reassigns on game init and validates them', () => {
    const c = newController()
    c.setAssets(loadWeatherManifest())
    const reassign = vi.spyOn(c.sim, 'onLocalReassign')
    c.onLocalReassign(1)
    c.onGameInit()
    c.onLoadAct(1)
    c.beginFrame(frame({ tick: 1 }))
    expect(reassign).not.toHaveBeenCalled()

    expect(() => c.onLocalReassign(2 as 0 | 1)).toThrow(/onLocalReassign: arg 2/)
    c.onLocalReassign(1)
    expect(() => c.beginFrame(frame({ levelId: 9999, tick: 2 }))).toThrow(/no level 9999/)
  })
})

describe('localReassignWeatherArg113c (0x6fb57e20 → 0x6fb31720)', () => {
  const alive = { snap: true, dead: false, mode: 1, usedSkillId: undefined } as const

  it('returns null when 0x6fb57e20 exits before the weather call (dead flag, player mode 0 / 17)', () => {
    expect(localReassignWeatherArg113c({ ...alive, dead: true })).toBeNull()
    expect(localReassignWeatherArg113c({ ...alive, mode: 0 })).toBeNull()
    expect(localReassignWeatherArg113c({ ...alive, mode: 17 })).toBeNull()
    expect(localReassignWeatherArg113c({ ...alive, snap: false, mode: 17, usedSkillId: 54 })).toBeNull()
  })

  it('passes the packet byte, zeroed when the used skill has Skills.txt warp', () => {
    expect(localReassignWeatherArg113c(alive)).toBe(1)
    expect(localReassignWeatherArg113c({ ...alive, mode: 3 })).toBe(1)
    expect(localReassignWeatherArg113c({ ...alive, snap: false })).toBe(0)
    expect(localReassignWeatherArg113c({ ...alive, snap: false, usedSkillId: 0 })).toBe(0)
    expect(localReassignWeatherArg113c({ ...alive, usedSkillId: 54 })).toBe(0) // Teleport
    expect(localReassignWeatherArg113c({ ...alive, usedSkillId: 275 })).toBe(0) // Dragon Flight
    expect(localReassignWeatherArg113c({ ...alive, usedSkillId: 0 })).toBe(1) // Attack
    expect(localReassignWeatherArg113c({ ...alive, usedSkillId: 132 })).toBe(1) // Leap
    expect(localReassignWeatherArg113c({ ...alive, usedSkillId: 107 })).toBe(1) // Charge
  })

  it('fails fast on a skill id outside Skills.txt', () => {
    expect(() => localReassignWeatherArg113c({ ...alive, usedSkillId: 99999 })).toThrow()
  })
})

describe('WeatherController.beginFrame camera', () => {
  it('steps once per tick and gives the next step the camera movement since the last step', () => {
    const c = newController()
    c.setAssets(loadWeatherManifest())
    c.onLoadAct(1)
    const update = vi.spyOn(c.sim, 'update')
    const deltas = (): Array<[number, number]> => update.mock.calls.map(([input]) => [input.camDx, input.camDy])

    c.beginFrame(frame({ tick: 1, camX: 1000, camY: 2000 }))
    expect([c.originX, c.originY]).toEqual([600, 1700])
    c.beginFrame(frame({ tick: 1, camX: 1003, camY: 2001 }))
    c.beginFrame(frame({ tick: 1, camX: 1005, camY: 2004 }))
    // No step yet: the origin stays at the last step.
    expect([c.originX, c.originY]).toEqual([600, 1700])
    c.beginFrame(frame({ tick: 2, camX: 1007, camY: 2004 }))
    expect([c.originX, c.originY]).toEqual([607, 1704])
    expect(deltas()).toEqual([
      [0, 0],
      [3, 1],
      [5, 4],
      [7, 4],
    ])
    expect(update.mock.results.map((r) => r.value)).toEqual([true, false, false, true])
  })

  it('rounds a fractional camera to whole screen pixels', () => {
    const c = newController()
    c.setAssets(loadWeatherManifest())
    c.onLoadAct(1)
    c.beginFrame(frame({ camX: 1000.4, camY: 2000.6 }))
    expect([c.originX, c.originY]).toEqual([600, 1701])
    expect([c.width, c.height]).toEqual([800, 600])
  })
})

describe('WeatherController floor pass tile filter (0x6fac3ce0)', () => {
  // Origin (600, 1700): a tile whose diamond top vertex is at screen (sx, sy) has its bitmap's
  // left edge at world (600 + sx − 80, 1700 + sy).
  const at = (sx: number, sy: number, extra: Partial<WeatherFloorTile> = {}): WeatherFloorTile => ({
    worldX: 600 + sx - FLOOR_TILE_HALF_WIDTH,
    worldY: 1700 + sy,
    type: 0,
    materialFlags: DT1_MATERIAL_WATER,
    ...extra,
  })

  function passTiles(tiles: WeatherFloorTile[]): Array<{ sx: number; sy: number }> {
    const c = newController()
    c.setAssets(loadWeatherManifest())
    c.onLoadAct(1)
    const floor = vi.spyOn(c.sim, 'floorPass')
    c.beginFrame(frame({ floorTiles: tiles }))
    expect(floor).toHaveBeenCalledTimes(1)
    const [visible, tick, mud] = floor.mock.calls[0]!
    expect(tick).toBe(1)
    expect(mud).toBe(weatherLevelInfo113c(1).mud)
    return visible.map((t) => ({ sx: t.sx, sy: t.sy }))
  }

  it('keeps orientation-0 water tiles whose diamond overlaps the screen, in draw order', () => {
    expect(
      passTiles([
        at(100, 50),
        at(200, 50, { materialFlags: 0x01 }),
        at(300, 50, { type: 3 }),
        at(300, 60, { materialFlags: 0x0102 }),
        at(-79, 10),
        at(-80, 10),
        at(879, 10),
        at(880, 10, { type: undefined, materialFlags: undefined }),
        at(400, -79),
        at(400, -80),
        at(400, 599),
        at(400, 600),
      ]),
    ).toEqual([
      { sx: 100, sy: 50 },
      { sx: 300, sy: 60 },
      { sx: -79, sy: 10 },
      { sx: 879, sy: 10 },
      { sx: 400, sy: -79 },
      { sx: 400, sy: 599 },
    ])
  })

  it('throws for a visible tile without DT1 type / materialFlags', () => {
    expect(() => passTiles([at(100, 50, { materialFlags: undefined })])).toThrow(/no DT1 type\/materialFlags/)
    expect(() => passTiles([at(100, 50, { type: undefined })])).toThrow(/no DT1 type\/materialFlags/)
  })
})
