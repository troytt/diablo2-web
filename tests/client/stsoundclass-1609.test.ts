/**
 * #1609 — stsoundclass only for a player caster of the skill's charclass (D2Client.dll 0x6FB52141..0x6FB52158:
 * `cmp dword [unit],0`, `cmp [unit+4], byte [skill+0xC]`); no fallback to the local player's class.
 */

import { describe, expect, it } from 'vitest'
import { getSkillSoundEntry113c } from '../../src/common/audio/skill-sounds-113c.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

describe('stsoundclass gating (#1609)', () => {
  it('a monster casting Bash does not play the barbarian grunt even when the local player is a Barbarian', () => {
    const world = new ClientWorld()
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 4, classId: 4, name: 'Bar', x: 100, y: 100 } as any)
    const merc = (world as any).ensureUnit('monster', 77)
    merc.x = 102
    merc.y = 100
    world.drainWorldSoundRequests()
    ;(world as any).applySkillCastToUnit(merc, 126, 104, 100, 1, true, 1000)
    const grunt = getSkillSoundEntry113c(126)!.stsoundclass
    expect(grunt).toBeGreaterThan(0)
    expect(world.drainWorldSoundRequests().some(r => r.soundId === grunt)).toBe(false)
  })

  it('the Barbarian player casting Bash plays it', () => {
    const world = new ClientWorld()
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 4, classId: 4, name: 'Bar', x: 100, y: 100 } as any)
    const me = (world as any).getUnit('player', 1)
    ;(world as any)._self.charClass = 'bar'
    world.drainWorldSoundRequests()
    ;(world as any).applySkillCastToUnit(me, 126, 104, 100, 1, true, 1000)
    const grunt = getSkillSoundEntry113c(126)!.stsoundclass
    expect(world.drainWorldSoundRequests().some(r => r.soundId === grunt)).toBe(true)
  })

  it('emitSkillCastSound without charclass never picks the class sound', () => {
    const world = new ClientWorld()
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 4, classId: 4, name: 'Bar', x: 100, y: 100 } as any)
    world.drainWorldSoundRequests()
    world.emitSkillCastSound({ skillId: 126, x: 1, y: 1, unitId: 5 })
    const grunt = getSkillSoundEntry113c(126)!.stsoundclass
    expect(world.drainWorldSoundRequests().some(r => r.soundId === grunt)).toBe(false)
  })
})
