/**
 * #1605 / #1606 — item casts (nSkillOrigin != -1, local player only): ItemCastSound / ItemCastOverlay replace stsound /
 * castoverlay (D2Client.dll 0x6FB52077 / 0x6FB521A7) and ItemCltEffect > 1 replaces cltdofunc (0x6FB52DD8).
 */

import { describe, expect, it } from 'vitest'
import { getSkillClientRow113c } from '../../src/common/skills/skill-client-113c.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

function setup() {
  const world = new ClientWorld()
  world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 1, classId: 1, name: 'Sor', x: 100, y: 100 } as any)
  const me = (world as any).getUnit('player', 1)
  world.drainWorldSoundRequests()
  return { world, me }
}

describe('item casts (#1605, #1606)', () => {
  it('Shiver Armor from an item uses ItemCastOverlay ice_cast_3; own cast uses castoverlay ice_cast_2', () => {
    const row = getSkillClientRow113c(50)!
    expect([row.castOverlay, row.itemCastOverlay]).toEqual(['ice_cast_2', 'ice_cast_3'])
    const a = setup()
    ;(a.world as any).applySkillCastToUnit(a.me, 50, 100, 100, 1, true, 1000, true)
    expect(a.me.overlays.some((o: any) => o.token === 'ice_cast_3')).toBe(true)
    const b = setup()
    ;(b.world as any).applySkillCastToUnit(b.me, 50, 100, 100, 1, true, 1000, false)
    expect(b.me.overlays.some((o: any) => o.token === 'ice_cast_2')).toBe(true)
  })

  it('Volcano from an item plays ItemCastSound instead of stsound', () => {
    const row = getSkillClientRow113c(244)!
    expect(row.itemCastSound).toBeGreaterThan(0)
    expect(row.itemCastSound).not.toBe(row.stSound)
    const { world, me } = setup()
    ;(world as any).applySkillCastToUnit(me, 244, 110, 100, 1, true, 1000, true)
    const ids = world.drainWorldSoundRequests().map(r => r.soundId)
    expect(ids).toContain(row.itemCastSound)
    expect(ids).not.toContain(row.stSound)
  })

  it('SelectSkill with an item GUID marks the following local cast as an item cast', () => {
    const { world } = setup()
    world.noteOutgoingCommand({ type: 'SelectSkill', hand: 'right', skill: 50, itemId: 77 } as any)
    expect((world as any)._self.rightSkillItemId).toBe(77)
    expect((world as any).isSelectedSkillFromItem(true)).toBe(true)
    world.noteOutgoingCommand({ type: 'SelectSkill', hand: 'right', skill: 50, itemId: 0xffffffff } as any)
    expect((world as any).isSelectedSkillFromItem(true)).toBe(false)
  })

  it('Nova from an item runs CltDo10: a cltmissilea ring around the caster', () => {
    const { world, me } = setup()
    me.castState = { skillId: 48, itemOrigin: true } as any
    ;(world as any).spawnMissilesForSkill(me, 48, 120, 100, 1)
    const nova = [...(world as any)._units.values()].filter((u: any) => u.unitType === 'missile' && u.missileKey === 'nova')
    expect(nova.length).toBeGreaterThan(8)
    for (const m of nova) expect([m.x, m.y]).toEqual([100, 100])
  })
})
