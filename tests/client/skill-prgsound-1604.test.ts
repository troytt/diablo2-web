/**
 * #1604 — Skills.txt prgsound: Hurricane state 144 StateSetFunc[7] (0x6FB22C20) / StateRemFunc[4] (0x6FB22BB0),
 * CltSt15 / CltSt46 start sound, CltDo78 mon death sentry.
 */

import { describe, expect, it } from 'vitest'
import { getSkillClientRow113c, SKILL_CLIENT_ROWS_113C } from '../../src/common/skills/skill-client-113c.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

function setup() {
  const world = new ClientWorld()
  world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 5, name: 'Dru', x: 100, y: 100 } as any)
  world.drainWorldSoundRequests()
  return world
}

describe('Skills.txt prgsound (#1604)', () => {
  it('1.13c prgsound rows', () => {
    expect(SKILL_CLIENT_ROWS_113C.filter(r => r.prgSound > 0).map(r => r.id)).toEqual([230, 250, 254, 265, 284, 312])
  })

  it('Hurricane: StateSet 144 with stat 350 = 250 starts druid_hurricane on the unit; StateEnd stops it', () => {
    const world = setup()
    const prg = getSkillClientRow113c(250)!.prgSound
    world.apply({
      type: 'StateSet',
      unit: { unitType: 0, id: 1 },
      state: 144,
      stats: [{ statId: 350, param: 0, value: 250 }],
    } as any)
    const on = world.drainWorldSoundRequests().filter(r => r.soundId === prg)
    expect(on).toHaveLength(1)
    expect(on[0]!.unit?.id).toBe(1)
    world.apply({ type: 'StateEnd', unit: { unitType: 0, id: 1 }, state: 144 } as any)
    const off = world.drainWorldSoundRequests().filter(r => r.soundId === prg)
    expect(off).toHaveLength(1)
    expect(off[0]!.kind).toBe('unit-sound-stop')
  })

  it('a state set without stat 350 plays nothing', () => {
    const world = setup()
    world.apply({ type: 'StateSet', unit: { unitType: 0, id: 1 }, state: 144, stats: [] } as any)
    const prg = getSkillClientRow113c(250)!.prgSound
    expect(world.drainWorldSoundRequests().some(r => r.soundId === prg)).toBe(false)
  })

  it('Arctic Blast (CltSt15) plays prgsound at cast start', () => {
    const world = setup()
    const caster = (world as any).getUnit('player', 1)
    ;(world as any).applySkillCastToUnit(caster, 230, 110, 100, 1, true, 1000)
    const prg = getSkillClientRow113c(230)!.prgSound
    expect(world.drainWorldSoundRequests().some(r => r.soundId === prg)).toBe(true)
  })
})
