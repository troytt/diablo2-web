/**
 * #1558: automap Fade (cmd 9, D2Client.dll 0x6fae9e20 / 0x6fb0f970) and the cell renderer fade
 * switch 0x6fb1032e..0x6fb10454.
 */
import { describe, expect, it } from 'vitest'
import {
  Minimap,
  automapDistanceFadeAlpha113c,
  automapUniformFadeAlpha113c,
} from '../src/client/ui/minimap.ts'

describe('automap fade cycle', () => {
  it('full automap cycles 0 -> 1 -> 2 -> 3 -> 0', () => {
    const m = new Minimap()
    m.bMinimap = false
    m.fadeState = 0
    expect([m.cycleFade(), m.cycleFade(), m.cycleFade(), m.cycleFade()]).toEqual([1, 2, 3, 0])
  })

  it('minimap skips state 1: 0 -> 2 -> 3 -> 0, and a stale 1 goes to 0', () => {
    const m = new Minimap()
    m.bMinimap = true
    m.fadeState = 0
    expect([m.cycleFade(), m.cycleFade(), m.cycleFade()]).toEqual([2, 3, 0])
    m.fadeState = 1
    expect(m.cycleFade()).toBe(0)
  })
})

describe('automap fade opacity', () => {
  it('state 0 opaque; state 2 TRANS50 everywhere', () => {
    for (const act0 of [0, 1, 2, 3, 4]) {
      expect(automapUniformFadeAlpha113c(0, false, act0)).toBe(1)
      expect(automapUniformFadeAlpha113c(2, false, act0)).toBe(0.5)
      expect(automapUniformFadeAlpha113c(2, true, act0)).toBe(0.5)
    }
  })

  it('state 3 only fades in Act I and Act III (mini TRANS50, full TRANS75)', () => {
    expect(automapUniformFadeAlpha113c(3, true, 0)).toBe(0.5)
    expect(automapUniformFadeAlpha113c(3, false, 0)).toBe(0.75)
    expect(automapUniformFadeAlpha113c(3, false, 2)).toBe(0.75)
    for (const act0 of [1, 3, 4]) {
      expect(automapUniformFadeAlpha113c(3, false, act0)).toBe(1)
      expect(automapUniformFadeAlpha113c(3, true, act0)).toBe(1)
    }
  })

  it('state 1 ring: TRANS25 / TRANS50 / TRANS75 by octile distance, opaque outside the box', () => {
    expect(automapDistanceFadeAlpha113c(400, 300, 400, 300)).toBe(0.25)
    expect(automapDistanceFadeAlpha113c(460, 300, 400, 300)).toBe(0.5)
    expect(automapDistanceFadeAlpha113c(500, 300, 400, 300)).toBe(0.75)
    expect(automapDistanceFadeAlpha113c(560, 300, 400, 300)).toBe(1)
    const m = new Minimap()
    m.fadeState = 1
    expect(m.getCellFadeAlpha(400, 300, 400, 300, false)).toBe(0.25)
    expect(m.getCellFadeAlpha(400, 300, 400, 300, true)).toBe(1)
  })
})

describe('#1564 automap names flag persists like the "AutoMap Party Names" registry value', () => {
  it('toggleNames is restored by a new Minimap', () => {
    const store = new Map<string, string>()
    const g = globalThis as any
    const prev = g.localStorage
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    }
    try {
      const a = new Minimap()
      expect(a.showNames).toBe(true)
      a.toggleNames()
      expect(new Minimap().showNames).toBe(false)
      a.toggleNames()
      expect(new Minimap().showNames).toBe(true)
    } finally {
      g.localStorage = prev
    }
  })
})
