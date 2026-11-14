import { describe, expect, it } from 'vitest'
import { SEED_RollLimitedRandomNumber } from '../../src/common/rng/d2-rng.ts'
import {
  nehlithakBoltShot,
  nehlithakControlPlan,
  nehlithakOrbitTarget,
  nehlithakSwooshShot,
  NEHLITHAK_BOLT_MISSILE,
  NEHLITHAK_DEBRIS1_MISSILE,
  NEHLITHAK_HOLE_MISSILE,
  NEHLITHAK_SWOOSH_MISSILE,
} from '../../src/client/world/boss-death-cltdo-113c.ts'
import { MISSILE_CLASS_ID_TO_KEY } from '../../src/common/skills/missiles-data.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

describe('MissCltDoFunc[62] nehlithakcontrol (0x6fb6a4a0, #1499)', () => {
  it('uses the real Missiles.txt rows', () => {
    expect(MISSILE_CLASS_ID_TO_KEY[NEHLITHAK_SWOOSH_MISSILE]).toBe('nehlithakswoosh')
    expect(MISSILE_CLASS_ID_TO_KEY[NEHLITHAK_DEBRIS1_MISSILE]).toBe('nehlithakdebris1')
    expect(MISSILE_CLASS_ID_TO_KEY[NEHLITHAK_DEBRIS1_MISSILE + 3]).toBe('nehlithakdebris4')
    expect(MISSILE_CLASS_ID_TO_KEY[NEHLITHAK_HOLE_MISSILE]).toBe('nehlithakhole')
    expect(MISSILE_CLASS_ID_TO_KEY[NEHLITHAK_BOLT_MISSILE]).toBe('brdeathlightningbolt')
  })

  it('plans 2 pieces every frame, a bolt when elapsed > 60 and % 20 == 0, the hole on frame 25', () => {
    expect(nehlithakControlPlan(0)).toEqual({ pieces: 2, bolt: false, hole: false })
    expect(nehlithakControlPlan(25)).toEqual({ pieces: 2, bolt: false, hole: true })
    expect(nehlithakControlPlan(60).bolt).toBe(false)
    expect(nehlithakControlPlan(80).bolt).toBe(true)
    expect(nehlithakControlPlan(81).bolt).toBe(false)
  })

  it('0x6fb63d60: z = RAND(125), k = RAND()&3, r = RAND(30); start (x+dx, y+dy), target start + (dy, -dx)', () => {
    const seed = { lo: 31337, hi: 666 }
    const ref = { ...seed }
    const s = nehlithakSwooshShot(seed, 40, 50)
    const z = SEED_RollLimitedRandomNumber(ref, 125)
    const k = SEED_RollLimitedRandomNumber(ref, 4)
    const r = SEED_RollLimitedRandomNumber(ref, 30)
    const dx = [1, 0, -1, 0][k]!
    const dy = [0, 1, 0, -1][k]!
    expect(s).toEqual({
      missile: r <= 3 ? 0x260 + r : 0x25f,
      sx: 40 + dx,
      sy: 50 + dy,
      tx: 40 + dx + dy,
      ty: 50 + dy - dx,
      altitude: z,
    })
  })

  it('0x6fb63c40: offsets 20 - RAND(40), never both zero', () => {
    for (let i = 1; i < 500; i++) {
      const b = nehlithakBoltShot({ lo: i * 7919, hi: 666 })
      expect(b.ox !== 0 || b.oy !== 0).toBe(true)
      expect(Math.abs(b.ox)).toBeLessThanOrEqual(20)
      expect(Math.abs(b.oy)).toBeLessThanOrEqual(20)
    }
  })

  it('MissCltDoFunc[63] 0x6fb61f20 orbit target', () => {
    expect(nehlithakOrbitTarget(12, 10, 10, 10)).toEqual({ tx: 12, ty: 8 })
  })

  it('ClientWorld: controller with an owner spawns exactly 2 pieces per frame and no nehlithakglow', () => {
    const world = new ClientWorld()
    const owner = { unitType: 'monster', id: 9, x: 100, y: 100 }
    ;(world as any).getUnit = (t: string, id: number) => (t === 'monster' && id === 9 ? owner : undefined)
    const ctl = (world as any).spawnMissileByKey('nehlithakcontrol', 100, 100, 100, 100, { ownerType: 'monster', ownerId: 9 })
    ;(world as any).stepMissileUnit(ctl)
    const keys = Array.from((world as any)._units.values()).map((u: any) => u.missileKey)
    const pieces = keys.filter((k: string) => k === 'nehlithakswoosh' || /^nehlithakdebris[1-4]$/.test(k))
    expect(pieces).toHaveLength(2)
    expect(keys).not.toContain('nehlithakglow')
  })
})
