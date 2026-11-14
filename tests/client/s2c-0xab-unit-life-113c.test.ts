import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { decodeD2gsS2cPacket } from '../../src/netproto/d2gs/registry.ts'

// D2Client.dll 0x6fb5d0b0 (S2C 0xAB): monster -> SetStat(6, life << 8); player -> roster life% = life * 100 / 128.
describe('S2C 0xAB unit life (1.13c)', () => {
  it('updates the roster life percent of another player and never touches a same-id monster', () => {
    const world = new ClientWorld()
    world.apply({
      type: 'Party',
      kind: 'roster',
      source: 0x5b,
      unitId: 7,
      charClass: 1,
      charName: 'Ally',
      charLevel: 10,
      partyId: 0xffff,
    })
    world.apply({ type: 'UnitAssign', unit: { unitType: 1, id: 7, classId: 5, x: 5000, y: 5000, lifePct: 128 } })
    const ev = decodeD2gsS2cPacket(new Uint8Array([0xab, 0x00, 0x07, 0x00, 0x00, 0x00, 0x40]))
    world.apply(ev)
    expect(world.party.get(7)?.lifePct).toBe(50)
    expect(world.getUnit('monster', 7)?.lifePct).toBe(128)
  })

  it('still updates monsters on the 128 scale', () => {
    const world = new ClientWorld()
    world.apply({ type: 'UnitAssign', unit: { unitType: 1, id: 9, classId: 5, x: 5000, y: 5000, lifePct: 128 } })
    world.apply(decodeD2gsS2cPacket(new Uint8Array([0xab, 0x01, 0x09, 0x00, 0x00, 0x00, 0x20])))
    expect(world.getUnit('monster', 9)?.lifePct).toBe(32)
  })
})
