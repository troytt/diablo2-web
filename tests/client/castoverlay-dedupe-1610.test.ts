/**
 * #1610 — castoverlay is not re-attached while the unit still carries it (D2Client.dll 0x6FB521CE -> 0x6FB19130
 * walks unit->pGfx->pOverlay for the same overlay id and skips 0x6FB1B300 when found).
 */

import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'

describe('castoverlay dedupe (#1610)', () => {
  it('a second Fire Bolt cast while fire_cast_1 plays keeps the running instance', () => {
    const world = new ClientWorld()
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 1, classId: 1, name: 'Sor', x: 100, y: 100 } as any)
    const me = (world as any).getUnit('player', 1)
    ;(world as any).applySkillCastToUnit(me, 36, 110, 100, 1, true, 1000)
    const first = me.overlays.find((o: any) => o.token === 'fire_cast_1')
    expect(first).toBeDefined()
    first.frame = 5
    ;(world as any).applySkillCastToUnit(me, 36, 110, 100, 1, true, 1100)
    const all = me.overlays.filter((o: any) => o.token === 'fire_cast_1')
    expect(all).toHaveLength(1)
    expect(all[0]).toBe(first)
    expect(all[0].frame).toBe(5)
  })

  it('after the overlay is gone the next cast attaches it again', () => {
    const world = new ClientWorld()
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 1, classId: 1, name: 'Sor', x: 100, y: 100 } as any)
    const me = (world as any).getUnit('player', 1)
    ;(world as any).applySkillCastToUnit(me, 36, 110, 100, 1, true, 1000)
    me.overlays = me.overlays.filter((o: any) => o.token !== 'fire_cast_1')
    ;(world as any).applySkillCastToUnit(me, 36, 110, 100, 1, true, 2000)
    expect(me.overlays.filter((o: any) => o.token === 'fire_cast_1')).toHaveLength(1)
  })
})
