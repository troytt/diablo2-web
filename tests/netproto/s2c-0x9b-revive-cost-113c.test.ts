import { describe, expect, it } from 'vitest'
import { decodeD2gsS2cPacket } from '../../src/netproto/d2gs/registry.ts'

// D2Client.dll 0x6fb5e1e0: only word[1] (name id) and word[3] (cost) are read; bytes 5..6 are ignored.
describe('S2C 0x9B MercReviveCost', () => {
  it('reads the cost as a u16 and ignores bytes 5..6', () => {
    const ev = decodeD2gsS2cPacket(new Uint8Array([0x9b, 0x0a, 0x00, 0x50, 0xc3, 0xff, 0xff]))
    expect(ev).toEqual({ type: 'Merc', kind: 'stat', nameId: 10, value: 50000 })
  })
})
