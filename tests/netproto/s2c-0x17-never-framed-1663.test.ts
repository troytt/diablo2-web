import { describe, expect, it } from 'vitest'
import { S2C_PACKET_SIZES } from '../../src/netproto/d2gs/tables/s2c-sizes.ts'
import { decodeD2gsS2cPacket, D2GS_S2C_REGISTRY } from '../../src/netproto/d2gs/registry.ts'
import { decodeRare113cS2cPacket } from '../../src/netproto/d2gs/s2c/misc.ts'

// #1663 (NET-11): D2Net's S->C size table (0x6FBFA900) has 0x17 = 0 (and 0x80 = 0), so D2NET_10033 never frames
// them; only D2Client's own handler table (0x6FB8DE60) lists them. No guessed decoder may remain.
describe('#1663 S2C opcodes with D2Net size 0 have no decoder', () => {
  it('0x17 and 0x80 are size 0 and have no registry entry', () => {
    expect(S2C_PACKET_SIZES[0x17]).toBe(0)
    expect(S2C_PACKET_SIZES[0x80]).toBe(0)
    expect(D2GS_S2C_REGISTRY[0x17]).toBeUndefined()
    expect(D2GS_S2C_REGISTRY[0x80]).toBeUndefined()
  })

  it('every registry entry is for an opcode D2Net can frame', () => {
    for (const [op, entry] of Object.entries(D2GS_S2C_REGISTRY)) {
      if (!entry) continue
      expect(S2C_PACKET_SIZES[Number(op)], `opcode ${op}`).not.toBe(0)
    }
  })

  it('decoding 0x17 fails instead of guessing a 6/7-byte layout', () => {
    expect(() => decodeRare113cS2cPacket(new Uint8Array([0x17, 1, 0, 1, 2, 3, 4]))).toThrow()
    expect(() => decodeD2gsS2cPacket(new Uint8Array([0x17, 1, 0, 1, 2, 3, 4]))).toThrow()
  })
})
