/**
 * Issue #1062: Claws of Thunder (#269) second-charge release. Skills.txt srvprgfunc2 = 36 ->
 * SKILLS_SrvDo036_ClawsOfThunder_ProgressiveFn2 (D2Game 0x6FCF6420) calls sub_6FD14170 from the target unit:
 * 64 'clawsofthundernova' (srvmissileb / cltmissileb, Missiles.txt #559 Vel 24 Range 13) on the radius-30 table,
 * velocity = calc1 (empty) + Vel.
 */
import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { CLTDO25_RING_X_113C, CLTDO25_RING_Y_113C } from '../src/common/skills/cltdo25-ring-113c.ts'

function finisherWithCharges(charges: number) {
  const cw = new ClientWorld()
  cw.selfId = 1
  ;(cw.self as any).charClass = 6
  const selfUnit = (cw as any).ensureUnit('player', 1)
  selfUnit.classId = 6
  selfUnit.x = 50
  selfUnit.y = 50
  for (let i = 0; i < charges; i++) (cw as any).applySkillCastToUnit(selfUnit, 269, 60, 52, 1)
  ;(cw as any).applySkillCastToUnit(selfUnit, 0, 60, 52, 1)
  return cw.getUnitsByType('missile').filter(m => m.missileKey === 'clawsofthundernova')
}

describe('Issue #1062: Claws of Thunder release fires the sub_6FD14170 64-way ring', () => {
  it('2 charges: 64 clawsofthundernova from the target, table aim, Range 13, Vel 24', () => {
    const novas = finisherWithCharges(2)
    expect(novas).toHaveLength(64)
    const speed = (16 * Math.floor(((24 << 8) * 75) / 100)) / 65536
    novas.forEach((m, i) => {
      expect([m.originX, m.originY]).toEqual([60, 52])
      expect([m.targetX! - 60, m.targetY! - 52]).toEqual([CLTDO25_RING_X_113C[i], CLTDO25_RING_Y_113C[i]])
      expect(m.maxTicks).toBe(13)
      expect(Math.hypot(m.vx ?? 0, m.vy ?? 0)).toBeCloseTo(speed, 9)
    })
  })

  it('1 charge: no nova ring', () => {
    expect(finisherWithCharges(1)).toHaveLength(0)
  })
})
