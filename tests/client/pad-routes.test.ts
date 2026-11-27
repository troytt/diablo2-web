import { describe, expect, it } from 'vitest'
import { firstPad, guessPartner, Regions } from '../../src/client/guide/pad-routes.ts'

const islands = (...spans: readonly (readonly [number, number])[]) => {
  const [w, h] = [60, 10]
  const walkable = new Uint8Array(w * h)
  for (const [from, to] of spans) for (let y = 1; y < h - 1; y++) for (let x = from; x <= to; x++) walkable[y * w + x] = 1
  return new Regions({ subWidth: w, subHeight: h, walkable })
}

describe('teleport pad routes', () => {
  it('plans the chain of pads across platforms to the one with the goal', () => {
    const regions = islands([1, 12], [16, 28], [32, 44], [48, 58])
    const pads = [
      { x: 10, y: 5, classId: 192 }, { x: 18, y: 5, classId: 192 },
      { x: 26, y: 5, classId: 305 }, { x: 34, y: 5, classId: 305 },
      { x: 3, y: 5, classId: 306 }, { x: 50, y: 5, classId: 306 },
    ]
    const partner = (pad: (typeof pads)[number]) => guessPartner(pad, pads, regions)
    expect(firstPad(regions, pads, { x: 6, y: 5 }, { x: 40, y: 5 }, partner)).toBe(pads[0])
    expect(firstPad(regions, pads, { x: 20, y: 5 }, { x: 40, y: 5 }, partner)).toBe(pads[2])
    expect(firstPad(regions, pads, { x: 6, y: 5 }, { x: 55, y: 5 }, partner)).toBe(pads[4])
    expect(firstPad(regions, pads, { x: 6, y: 5 }, { x: 8, y: 5 }, partner)).toBeNull()
  })
})
