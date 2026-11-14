/**
 * #1611 / #1614 — keyframe Do sound: the client Do tail (D2Client.dll 0x6FB52E5F) plays only Skills.txt dosound;
 * dosound a / b are read by CltDo16 Jab alone (0x6FAC4F7C player -> a, 0x6FAC4F9C monster -> b).
 */

import { describe, expect, it } from 'vitest'
import { getSkillSoundEntry113c, SkillSoundController113c } from '../../src/common/audio/skill-sounds-113c.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

function keyframe(world: ClientWorld, skillId: number, unitId: number, unitType: 'player' | 'monster') {
  world.drainWorldSoundRequests()
  world.emitSkillKeyframeSound({ skillId, flag: 1, unitId, unitType, x: 1, y: 1 })
  return world.drainWorldSoundRequests().filter(r => r.kind === 'skill-keyframe')
}

describe('keyframe dosound (#1611, #1614)', () => {
  it('Jab: player -> dosound a (weapon_1ht_1), monster -> dosound b (weapon_2ht_1)', () => {
    const world = new ClientWorld()
    const e = getSkillSoundEntry113c(10)!
    expect(keyframe(world, 10, 1, 'player')[0]!.doSoundId).toBe(e.dosoundA)
    expect(keyframe(world, 10, 9, 'monster')[0]!.doSoundId).toBe(e.dosoundB)
  })

  it('Strafe (dosound empty, dosound a = paladin_charge) has no Do sound', () => {
    const world = new ClientWorld()
    const reqs = keyframe(world, 26, 1, 'player')
    const e = getSkillSoundEntry113c(26)!
    expect(e.dosoundA).toBeGreaterThan(0)
    for (const r of reqs) expect(r.doSoundId).toBe(0)
  })

  it('the controller plays exactly doSoundId and never falls back to dosound a / b', () => {
    const played: number[] = []
    const ctl = new SkillSoundController113c({ emitSound: (id: number) => (played.push(id), 1) } as any)
    ;(ctl as any).emitSound = (id: number) => (played.push(id), 1)
    ctl.onAnimKeyframe({ skillId: 294, flag: 1 })
    expect(played).toEqual([getSkillSoundEntry113c(294)!.dosound])
    played.length = 0
    ctl.onAnimKeyframe({ skillId: 294, flag: 2 })
    expect(played).toEqual([getSkillSoundEntry113c(294)!.dosound])
    played.length = 0
    ctl.onAnimKeyframe({ skillId: 10, flag: 1, doSoundId: getSkillSoundEntry113c(10)!.dosoundB })
    expect(played).toEqual([getSkillSoundEntry113c(10)!.dosoundB])
  })
})
