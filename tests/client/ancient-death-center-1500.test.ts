import { describe, expect, it } from 'vitest'
import { SEED_RollLimitedRandomNumber } from '../../src/common/rng/d2-rng.ts'
import { ancientDeathCenterTick, ANCIENT_DEATH_CLOUD_MISSILE } from '../../src/client/world/boss-death-cltdo-113c.ts'
import { CANONICAL_113C_MISSILES } from '../../src/common/skills/missiles-data.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

describe('MissCltDoFunc[55] ancient death center (0x6fb63860, #1500)', () => {
  it('fires only on frames where elapsed % 3 == 0', () => {
    for (let e = 0; e < 12; e++) {
      const r = ancientDeathCenterTick(e, { lo: 99, hi: 666 }, 50, 60)
      expect(r !== null).toBe(e % 3 === 0)
    }
  })

  it('rolls ox, oy = RAND(20), then start jitter RAND(2) - 1 on x then y; target = start + o - 10', () => {
    const seed = { lo: 4242, hi: 666 }
    const ref = { ...seed }
    const r = ancientDeathCenterTick(6, seed, 100, 200)!
    const ox = SEED_RollLimitedRandomNumber(ref, 20)
    const oy = SEED_RollLimitedRandomNumber(ref, 20)
    const sx = 100 + SEED_RollLimitedRandomNumber(ref, 2) - 1
    const sy = 200 + SEED_RollLimitedRandomNumber(ref, 2) - 1
    expect(r).toEqual({ sx, sy, tx: sx + ox - 10, ty: sy + oy - 10 })
    expect(seed).toEqual(ref)
  })

  it('creates the moving cloud row 542 with its own Range (no stationary / maxTicks override)', () => {
    expect(ANCIENT_DEATH_CLOUD_MISSILE).toBe(CANONICAL_113C_MISSILES['ancient death cloud']!.id)
    const world = new ClientWorld()
    const center = (world as any).spawnMissileByKey('ancient death center', 100, 100, 100, 100, { ownerType: 'monster', ownerId: 7 })
    ;(world as any).stepMissileUnit(center)
    const clouds = Array.from((world as any)._units.values()).filter((u: any) => u.missileKey === 'ancient death cloud') as any[]
    expect(clouds).toHaveLength(1)
    const c = clouds[0]
    expect(c.maxTicks).toBe(CANONICAL_113C_MISSILES['ancient death cloud']!.range)
    expect(Math.hypot(c.targetX - c.x, c.targetY - c.y) === 0 || Math.hypot(c.vx, c.vy) > 0).toBe(true)
  })
})
