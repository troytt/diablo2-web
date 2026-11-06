import { describe, expect, it } from 'vitest'
import { decode0x81AssignMerc } from '../../src/netproto/index.ts'

function pkt81(seed: number, nameDword: number): Uint8Array {
  const p = new Uint8Array(20)
  const dv = new DataView(p.buffer)
  p[0] = 0x81
  p[1] = 7
  dv.setUint16(2, 338, true)
  dv.setUint32(4, 1, true)
  dv.setUint32(8, 777, true)
  dv.setUint32(12, seed >>> 0, true)
  dv.setUint32(16, nameDword >>> 0, true)
  return p
}

// #1661 (NET-9): D2Client 0x6FB5EBA0 passes {u32 @0xC, u32 @0x10, 0} to 0x6FAD1D60, which hands
// {u32 @0xC, u16 @0x10} to the merc name setter 0x6FAFEF50. There is no "@0xC == 0 -> use @0x12" fallback.
describe('#1661 S2C 0x81 seed has no fallback', () => {
  it('seed is always u32 @0xC and nameId is the low word of u32 @0x10', () => {
    const ev = decode0x81AssignMerc(pkt81(0, 0x12340007)) as any
    expect(ev.seed).toBe(0)
    expect(ev.nameId).toBe(7)
    const ev2 = decode0x81AssignMerc(pkt81(0xdeadbeef, 0x00000009)) as any
    expect(ev2.seed).toBe(0xdeadbeef)
    expect(ev2.nameId).toBe(9)
  })

  it('requires the fixed 20-byte layout', () => {
    expect(() => decode0x81AssignMerc(new Uint8Array(18))).toThrow(RangeError)
  })
})
