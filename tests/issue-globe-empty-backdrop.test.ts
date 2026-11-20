/**
 * The unfilled part of the health/mana globes must stay TRANSLUCENT: the HUD
 * canvas is a transparent overlay above the world, and 1.13c shows the game
 * darkened through the empty globe area. The socket bowl used to be an opaque
 * `#080605` circle, rendering a black upper half at low HP (user-reported).
 */
import { describe, expect, it } from 'vitest'
import { GLOBE_EMPTY_BACKDROP_STYLE } from '../src/client/ui/globes.ts'

describe('[globe empty backdrop] translucency parity', () => {
  it('1. empty-globe backdrop is a translucent rgba fill, never opaque black', () => {
    expect(GLOBE_EMPTY_BACKDROP_STYLE).toMatch(/^rgba\(/)
    const alpha = Number(GLOBE_EMPTY_BACKDROP_STYLE.match(/,\s*([\d.]+)\)$/)![1])
    expect(alpha).toBeGreaterThan(0)
    expect(alpha).toBeLessThan(1)
  })
})
