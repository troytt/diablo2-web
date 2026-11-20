import { describe, expect, it } from 'vitest'
import { steadyLightSub } from '../../src/client/loop/steady-light.ts'
import { LightFpsCounter } from '../../src/common/drlg/light-grid.ts'
import { LogicClock } from '../../src/client/loop/logic-clock.ts'
import { MotionSmoothing } from '../../src/client/loop/motion-smoothing.ts'
import { SceneMotionSmoother } from '../../src/client/loop/scene-motion-smoothing.ts'
import { buildSceneDrawables, type RenderableUnitInput } from '../../src/client/view/unit-drawables.ts'
import type { ClientSceneWorldAdapter } from '../../src/client/view/scene-source.ts'

const walker = (x: number): RenderableUnitInput => ({ kind: 'player', id: 7, classId: 1, x, y: 20, mode: 2, isLocalPlayer: false })
const scene = (tick: number, units: RenderableUnitInput[]): ClientSceneWorldAdapter => ({ tick, levelId: 8, actId: 1, playerSubX: 100, playerSubY: 100, ambient: null, units })

describe('steady dungeon light', () => {
  it('places the player light at the last tick position instead of the smoothed one', () => {
    expect(steadyLightSub({ playerSubX: 100.4, playerSubY: 50.2, lightSubX: 100, lightSubY: 50 }, { x: 20.4, y: 10.2 })).toEqual({ x: 20, y: 10 })
    expect(steadyLightSub({ playerSubX: 100.4, playerSubY: 50.2 }, { x: 20.4, y: 10.2 })).toEqual({ x: 20.4, y: 10.2 })
  })

  it('does not count a loading stall as a slow frame rate', () => {
    const fps = new LightFpsCounter()
    Array.from({ length: 10 }, (_, i) => fps.onFrameRendered(i * 16))
    Array.from({ length: 150 }, (_, i) => fps.onFrameRendered(2500 + i * 16))
    expect(fps.fps).toBe(25)
    Array.from({ length: 40 }, (_, i) => fps.onFrameRendered(2500 + (150 + i) * 16))
    expect(fps.fps).toBe(Math.floor(189 / 3))
  })

  it('lights another walking player and its sprite from its last tick position at every frame of the tick', () => {
    const clock = new LogicClock(0)
    const smoother = new SceneMotionSmoother(new MotionSmoothing(), clock)
    clock.advance(40)
    smoother.beginFrame(50)
    smoother.apply(scene(1, [walker(10)]))
    clock.advance(80)
    const frames = [0.2, 0.5, 0.9].map((alpha) => {
      smoother.beginFrame(80 + alpha * 40)
      const [unit] = Array.from(smoother.apply(scene(2, [walker(11)])).units)
      const drawn = buildSceneDrawables([unit!], { originX: 0, originY: 0, tick: 2 })
      const sprite = drawn.unitDrawables.find((d) => d.id === 7)!
      return { x: Math.round(sprite.subX * 10) / 10, light: sprite.lightSubX, emitter: drawn.lightEmitters.find((e) => e.unitId === 7)?.x8 }
    })
    expect(frames.map((f) => f.x)).toEqual([10.2, 10.5, 10.9])
    expect(new Set(frames.map((f) => f.light))).toEqual(new Set([10]))
    expect(new Set(frames.map((f) => f.emitter))).toEqual(new Set([88]))
  })
})
