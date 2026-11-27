import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { decodeD2gsS2cPacket } from '../../src/netproto/d2gs/registry.ts'

// D2Client.dll 0x6fb5d760 (S2C 0xA4): classId < MonStats count -> 0x6fb1a0c0 preload.
describe('S2C 0xA4 MonsterSpecial preload', () => {
  it('queues valid MonStats ids and drops out-of-range ones', () => {
    const world = new ClientWorld()
    world.apply(decodeD2gsS2cPacket(new Uint8Array([0xa4, 0x10, 0x01])))
    world.apply(decodeD2gsS2cPacket(new Uint8Array([0xa4, 0xde, 0x02])))
    expect(world.drainMonsterPreloadRequests()).toEqual([272])
    expect(world.drainMonsterPreloadRequests()).toEqual([])
  })
})
