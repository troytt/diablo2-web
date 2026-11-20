import { describe, expect, it } from 'vitest'
import {
  ArcaneStarfield113c,
  ArreatClouds113c,
  CLOUD_COUNT,
  STARFIELD_STAR_COUNT,
  summitTiles113c,
  timeSeed113c,
} from '../../src/client/scene/backdrop-113c.ts'
import { playerClientX113c } from '../../src/client/scene/backdrop-pass.ts'

function greyPalette(): Uint8Array {
  const p = new Uint8Array(768)
  for (let i = 0; i < 256; i += 1) p.set([i, i, i], i * 3)
  return p
}

describe('Arcane Sanctuary starfield (D2Client 0x6fb3ae00 / 0x6fb3ac40, #1538)', () => {
  it('builds 8 colours from base i*128/7+128 ± 32 and 256 stars with speed -1..-5 inside the screen', () => {
    const f = new ArcaneStarfield113c({ lo: 1234, hi: 666 }, 800, 600, greyPalette())
    expect(f.colors).toHaveLength(8)
    f.colors.forEach((c, i) => {
      const base = Math.trunc((i * 128) / 7) + 128
      expect(c).toBeGreaterThanOrEqual(base - 32)
      expect(c).toBeLessThanOrEqual(Math.min(base + 31, 255))
    })
    expect(f.stars).toHaveLength(STARFIELD_STAR_COUNT)
    for (const s of f.stars) {
      expect(s.x).toBeGreaterThanOrEqual(0)
      expect(s.x).toBeLessThan(800)
      expect(s.y).toBeGreaterThanOrEqual(0)
      expect(s.y).toBeLessThan(600)
      expect(s.speed).toBeGreaterThanOrEqual(-5)
      expect(s.speed).toBeLessThanOrEqual(-1)
      expect(f.colors).toContain(s.color)
    }
  })

  it('moves only when more than 40 ms passed and respawns stars that cross x < 0 at the right edge', () => {
    const f = new ArcaneStarfield113c({ lo: 99, hi: 666 }, 800, 600, greyPalette())
    const before = f.stars.map((s) => s.x)
    f.step(40)
    expect(f.stars.map((s) => s.x)).toEqual(before)
    f.step(41)
    f.stars.forEach((s, i) => {
      if (before[i]! + s.speed >= 0 && s.x < 800) expect(s.x).toBeLessThan(before[i]!)
    })
    for (let t = 2; t < 400; t += 1) f.step(41 * t)
    expect(f.stars.some((s) => s.x >= 799)).toBe(true)
    for (const s of f.stars) expect(s.x).toBeLessThan(807)
  })
})

describe('Arreat Summit sky (D2Client 0x6fb3a6c0, #1537)', () => {
  it('summit01 offset/column from the player client X relative to 0x274F, 3 rows at 800x600', () => {
    const at = summitTiles113c(0x274f, 800, 600, 3)
    expect(at.filter((t) => t.y === 256).map((t) => [t.frame, t.x])).toEqual([[0, 0], [1, 256], [2, 512], [3, 768]])
    expect(at.filter((t) => t.y === 768).map((t) => t.frame)).toEqual([8, 9, 10, 11])
    // d = -8 * 300: q = -300, offset = -(-300 rem 256) = 44 > 0 -> an extra column at x = 44 - 256.
    const left = summitTiles113c(0x274f - 2400, 800, 600, 3).filter((t) => t.y === 256)
    expect(left[0]).toEqual({ frame: 2, x: 44 - 256, y: 256 })
    expect(left[1]).toEqual({ frame: 3, x: 44, y: 256 })
    // q = 300: offset = -44, column = 1.
    const right = summitTiles113c(0x274f + 2400, 800, 600, 3).filter((t) => t.y === 256)
    expect(right[0]).toEqual({ frame: 1, x: -44, y: 256 })
  })

  it('640-wide screens draw 2 rows; widescreen viewports keep tiling with (column + k) mod 4', () => {
    expect(new Set(summitTiles113c(0x274f, 640, 480, 2).map((t) => t.y))).toEqual(new Set([256, 512]))
    const wide = summitTiles113c(0x274f, 1280, 720, 3).filter((t) => t.y === 256)
    expect(wide.map((t) => t.frame)).toEqual([0, 1, 2, 3, 0])
  })

  it('10 clouds: x16 < width*16, y < 250, speed 8..23; past (width + 0x170)*16 they wrap to -0x1700 with y < 300', () => {
    const c = new ArreatClouds113c({ lo: 7, hi: 666 }, 800)
    expect(c.clouds).toHaveLength(CLOUD_COUNT)
    for (const cl of c.clouds) {
      expect(cl.x16).toBeLessThan(800 * 16)
      expect(cl.y).toBeLessThan(250)
      expect(cl.speed).toBeGreaterThanOrEqual(8)
      expect(cl.speed).toBeLessThanOrEqual(23)
    }
    const first = c.clouds[0]!
    first.x16 = (800 + 0x170) * 16 - first.speed + 1
    c.step()
    expect(first.x16).toBe(-0x1700)
    expect(first.y).toBeLessThan(300)
    expect(ArreatClouds113c.screenX({ x16: -0x1700, y: 0, speed: 8 })).toBe(-368)
  })

  it('player client X follows PATH_UpdateClientCoords ((x - y) * 16) and the time seed is 31-bit', () => {
    expect(playerClientX113c(100, 40)).toBe(960)
    expect(playerClientX113c(40, 100)).toBe(-960)
    expect(timeSeed113c(1, 2, 3)).toBeLessThan(0x80000000)
  })
})
