import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'

// D2Client.dll 0x6fafb8a0: S2C 0x28 `pkt[1]` indexes the unit table directly (2 = object, 1 = monster).
describe('S2C 0x28 unit type (1.13c)', () => {
  const quests = () => new Uint16Array(48).fill(0x1234)

  it('copies the quest record when the 0x28 target is a known object (type 2)', () => {
    const world = new ClientWorld()
    world.apply({ type: 'UnitAssign', unit: { unitType: 2, id: 77, classId: 30, x: 5000, y: 5000 } })
    world.apply({ type: 'QuestState', kind: 'update', source: 0x28, updateType: 2, unitId: 77, quests: quests() })
    expect(world.quests[0]).toBe(0x1234)
  })

  it('does not treat type 4 as an object (item table lookup fails -> no copy)', () => {
    const world = new ClientWorld()
    world.apply({ type: 'UnitAssign', unit: { unitType: 2, id: 78, classId: 30, x: 5000, y: 5000 } })
    world.apply({ type: 'QuestState', kind: 'update', source: 0x28, updateType: 4, unitId: 78, quests: quests() })
    expect(world.quests[0] ?? 0).toBe(0)
  })
})
