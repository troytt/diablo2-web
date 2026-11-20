/**
 * Issue #1627: GetHit / Block animation rates use base 50 (100 for Block under Holy Shield).
 *
 * `D2Common.dll` 1.13c `UNITS_UpdateAnimRateAndVelocity`:
 * - Block (player 9 / monster 6, `0x6FD7EF90`) `0x6FD831FE..0x6FD83283`:
 *   `rate = 50 + dim(FBR stat 102)`, `100 + dim(FBR)` while state 101 `holyshield`.
 * - GetHit (player 4 / monster 3, `0x6FD7EFC0`) `0x6FD83298..0x6FD832C7`: `rate = 50 + dim(FHR stat 99)`.
 * - Knockback (player 19 / monster 13, `0x6FD7F010`) `0x6FD832C9..0x6FD83318`:
 *   step = `UNITS_GetBaseAnimSpeed` (`0x6FD7FB50`: 213 for players), no rate stat.
 * - step = `AnimData.speed * rate / 100`; one-shot ends at `ceil(frames*256/step) - 1` ticks.
 */
import { describe, expect, it } from 'vitest'

import {
  computeBlockEffRate113c,
  computeEffectiveAnimRate113c,
  computeGetHitEffRate113c,
  computeOneShotTicks,
  computeStepSpeed256,
  getCharAnimClip113c,
  resolveCharacterAnimSpeedParams,
  STAT_FASTERBLOCKRATE,
  STAT_FASTERHITRECOVERY,
} from '../../src/common/units/char-anim-speed.ts'

const stats = (fhr: number, fbr = 0) => ({
  get: (id: number) => (id === STAT_FASTERHITRECOVERY ? fhr : id === STAT_FASTERBLOCKRATE ? fbr : 0),
})

describe('issue #1627: GH / BL anim rate base 50', () => {
  it('effRate encodes rate - 100 with base 50 and no 75 cap', () => {
    expect(computeGetHitEffRate113c(0)).toBe(-50)
    expect(computeGetHitEffRate113c(86)).toBe(0) // dim(86) = 50 -> rate 100
    expect(computeGetHitEffRate113c(600)).toBe(50) // dim(600) = 100 (no 75 clamp) -> rate 150
    expect(computeBlockEffRate113c(0)).toBe(-50)
    expect(computeBlockEffRate113c(0, true)).toBe(0) // holyshield base 100
    expect(computeEffectiveAnimRate113c('gh', { fhr: 0 })).toBe(-50)
    expect(computeEffectiveAnimRate113c(4, { fhr: 0 })).toBe(-50)
    expect(computeEffectiveAnimRate113c('bl', { fbr: 0, fhr: 200 })).toBe(-50) // FHR never feeds block
    expect(computeEffectiveAnimRate113c(9, { fbr: 0, holyShield: true })).toBe(0)
    expect(computeEffectiveAnimRate113c(19, { fhr: 200 })).toBe(0)
  })

  it('Amazon 1.13c FHR breakpoints (AMGHHTH 6 frames @256: 0% -> 11 ticks)', () => {
    const clip = getCharAnimClip113c('am', 'gh')
    expect(clip.frames).toBe(6)
    expect(clip.speed).toBe(256)
    const ticksAt = (fhr: number) =>
      resolveCharacterAnimSpeedParams('am', 'gh', { unitStats: stats(fhr), weaponClass: 'hth' })
    expect(ticksAt(0).stepSpeed256).toBe(128)
    const table: ReadonlyArray<readonly [number, number]> = [
      [0, 11], [6, 10], [13, 9], [20, 8], [32, 7], [52, 6], [86, 5], [174, 4], [600, 3],
    ]
    for (const [fhr, ticks] of table) {
      const p = ticksAt(fhr)
      expect(computeOneShotTicks(p.frames, p.stepSpeed256), `FHR ${fhr}`).toBe(ticks)
    }
    expect(computeOneShotTicks(6, computeStepSpeed256(256, computeGetHitEffRate113c(5)))).toBe(11)
  })

  it('block uses FBR base 50, Holy Shield base 100', () => {
    const plain = resolveCharacterAnimSpeedParams('pa', 'bl', { unitStats: stats(0, 0), weaponClass: '1hs' })
    const holy = resolveCharacterAnimSpeedParams('pa', 'bl', {
      unitStats: stats(0, 0),
      weaponClass: '1hs',
      holyShield: true,
    })
    expect(plain.stepSpeed256).toBe(Math.floor((plain.baseSpeed * 50) / 100))
    expect(holy.stepSpeed256).toBe(holy.baseSpeed)
    expect(holy.durationMs).toBeLessThan(plain.durationMs)
  })

  it('knockback (mode 19) steps at GetBaseAnimSpeed 213 regardless of FHR', () => {
    const p0 = resolveCharacterAnimSpeedParams('am', 19, { unitStats: stats(0), weaponClass: 'hth' })
    const p1 = resolveCharacterAnimSpeedParams('am', 19, { unitStats: stats(200), weaponClass: 'hth' })
    expect(p0.stepSpeed256).toBe(213)
    expect(p1.stepSpeed256).toBe(213)
    expect(p0.frames).toBe(6)
  })
})
