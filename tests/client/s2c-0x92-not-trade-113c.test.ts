import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { decodeD2gsS2cPacket } from '../../src/netproto/d2gs/registry.ts'

// D2Client.dll 0x6fb5e230 -> 0x6fb34c60: unit inventory strip; the trade window is not involved.
describe('S2C 0x92 is not a trade packet', () => {
  it('leaves the trade state untouched', () => {
    const world = new ClientWorld()
    world.apply(decodeD2gsS2cPacket(new Uint8Array([0x78, ...new Array(16).fill(0x41), 0x07, 0x00, 0x00, 0x00])))
    const before = JSON.stringify(world.trade)
    world.apply(decodeD2gsS2cPacket(new Uint8Array([0x92, 0x00, 0x07, 0x00, 0x00, 0x00])))
    expect(JSON.stringify(world.trade)).toBe(before)
  })
})
