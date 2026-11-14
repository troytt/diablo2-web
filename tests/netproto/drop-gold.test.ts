import { describe, expect, it } from 'vitest'
import { encodeD2gsClientCommand } from '../../src/netproto/d2gs/registry.ts'

describe('C2S 0x50 DropGold', () => {
  it('encodes u8 0x50 | u32 unitId | u32 amount (9 bytes)', () => {
    const [pkt] = encodeD2gsClientCommand({ type: 'DropGold', unitId: 0x01020304, amount: 1234 })
    expect(Array.from(pkt!)).toEqual([0x50, 0x04, 0x03, 0x02, 0x01, 0xd2, 0x04, 0x00, 0x00])
  })
})
