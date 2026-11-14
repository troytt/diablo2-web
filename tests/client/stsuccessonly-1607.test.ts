/**
 * #1607 — stsuccessonly: a failing SkillCltStFunc skips stsound / castoverlay / cast light (D2Client.dll
 * 0x6FB52037..0x6FB52071). Verified start functions: CltSt20 / CltSt21 (corpse target), CltSt5 (target, not town).
 */

import { describe, expect, it } from 'vitest'
import { getSkillClientRow113c } from '../../src/common/skills/skill-client-113c.ts'
import { getSkillSoundEntry113c } from '../../src/common/audio/skill-sounds-113c.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { cltStSucceeds113c } from '../../src/client/world/world-skill-missiles.ts'

function setup() {
  const world = new ClientWorld()
  world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 2, classId: 2, name: 'Nec', x: 100, y: 100 } as any)
  ;(world as any).areaId = 2
  const me = (world as any).getUnit('player', 1)
  const mon = (world as any).ensureUnit('monster', 42)
  mon.x = 104
  mon.y = 100
  world.drainWorldSoundRequests()
  return { world, me, mon }
}

describe('stsuccessonly (#1607)', () => {
  it('Corpse Explosion rows carry stsuccessonly', () => {
    expect(getSkillClientRow113c(74)!.stSuccessOnly).toBe(true)
    expect(getSkillClientRow113c(74)!.cltStFunc).toBe(21)
  })

  it('Corpse Explosion without a corpse target: CltSt21 fails -> no start sound', () => {
    const { world, me } = setup()
    expect(cltStSucceeds113c(world as any, me, 74)).toBe(false)
    ;(world as any).applySkillCastToUnit(me, 74, 104, 100, 1, true, 1000)
    const st = getSkillSoundEntry113c(74)!.stsound
    expect(world.drainWorldSoundRequests().some(r => r.soundId === st)).toBe(false)
    expect(me.castState?.cltStFailed).toBe(true)
  })

  it('Corpse Explosion on a corpse target plays the start sound', () => {
    const { world, me, mon } = setup()
    mon.dead = true
    me.targetUnit = { unitType: 'monster', id: 42 }
    expect(cltStSucceeds113c(world as any, me, 74)).toBe(true)
    ;(world as any).applySkillCastToUnit(me, 74, 104, 100, 1, true, 1000)
    const st = getSkillSoundEntry113c(74)!.stsound
    expect(world.drainWorldSoundRequests().some(r => r.soundId === st)).toBe(true)
  })

  it('Psychic Hammer (CltSt5) fails in town', () => {
    const { world, me } = setup()
    me.targetUnit = { unitType: 'monster', id: 42 }
    expect(cltStSucceeds113c(world as any, me, 253)).toBe(true)
    ;(world as any).areaId = 1
    expect(cltStSucceeds113c(world as any, me, 253)).toBe(false)
  })
})
