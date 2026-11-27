import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { decodeD2gsS2cPacket } from '../../src/netproto/d2gs/registry.ts'

// D2Client.dll 0x6fb5d890 (S2C 0x65): signed u16 kill count -> roster+0x18.
describe('S2C 0x65 PlayerKillCount', () => {
  it('decodes a signed count and stores it on the roster entry', () => {
    const neg = decodeD2gsS2cPacket(new Uint8Array([0x65, 0x07, 0x00, 0x00, 0x00, 0xfe, 0xff]))
    expect(neg).toMatchObject({ type: 'Party', source: 0x65, unitId: 7, killCount: -2 })
    const world = new ClientWorld()
    world.apply({ type: 'Party', kind: 'roster', source: 0x5b, unitId: 7, charClass: 1, charName: 'Ally', charLevel: 3, partyId: 0xffff })
    world.apply(decodeD2gsS2cPacket(new Uint8Array([0x65, 0x07, 0x00, 0x00, 0x00, 0x05, 0x00])))
    expect(world.party.get(7)?.killCount).toBe(5)
    expect(world.party.get(7)?.relation).toBeUndefined()
  })

  it('ignores players without a roster entry', () => {
    const world = new ClientWorld()
    world.apply(decodeD2gsS2cPacket(new Uint8Array([0x65, 0x09, 0x00, 0x00, 0x00, 0x05, 0x00])))
    expect(world.party.has(9)).toBe(false)
  })
})
