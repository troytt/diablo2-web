import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { decodeD2gsS2cPacket } from '../../src/netproto/d2gs/registry.ts'

// D2Client.dll 0x6fb5c040 (S2C 0x66 handler) is a bare `ret`.
describe('S2C 0x66 is a no-op in the 1.13c client', () => {
  it('does not create or modify party entries', () => {
    const world = new ClientWorld()
    world.apply(decodeD2gsS2cPacket(new Uint8Array([0x66, 0x07, 0x00, 0x00, 0x00, 0x32, 0x00])))
    expect(world.party.has(7)).toBe(false)
  })
})
