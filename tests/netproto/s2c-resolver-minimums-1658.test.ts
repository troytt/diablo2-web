import { describe, expect, it } from 'vitest'
import { resolveS2cPacketSize as resolveStruct } from '../../src/netproto/d2gs/tables/s2c-sizes.ts'
import { resolveFramedS2cPacketSize } from '../../src/netproto/d2gs/framing-s2c.ts'
import { decodeD2gsS2cPacket } from '../../src/netproto/d2gs/registry.ts'

// #1658 (NET-6): D2NET_10033 (0x6FBF6750) waits until 13 (0x16, 0x6FBF67A4), 34 (0x5B, 0x6FBF67F4),
// 9 (0x94, 0x6FBF6808) and 8 (0xB3, 0x6FBF6907) bytes are buffered before it computes the size.
describe('#1658 S->C variable-length resolver minimum-buffer thresholds', () => {
  it('stream framing waits for the D2Net minimum even when the computed size is smaller', () => {
    const p94 = new Uint8Array([0x94, 0x00, 0x01, 0x00, 0x00, 0x00]) // count 0 -> 6 bytes
    expect(resolveStruct(p94, 0)).toEqual({ status: 'incomplete' })
    const buffered = new Uint8Array(9)
    buffered.set(p94)
    buffered.set([0x94, 0x00, 0x01], 6)
    expect(resolveStruct(buffered, 0)).toEqual({ status: 'ok', size: 6 })

    const pB3 = new Uint8Array([0xb3, 0x00, 0, 0, 0, 0, 0]) // len 0 -> 7 bytes
    expect(resolveStruct(pB3, 0)).toEqual({ status: 'incomplete' })
    expect(resolveStruct(new Uint8Array([...pB3, 0xb3]), 0)).toEqual({ status: 'ok', size: 7 })

    expect(resolveStruct(new Uint8Array(12).fill(0).map((v, i) => (i === 0 ? 0x16 : i === 1 ? 13 : v)), 0)).toEqual({
      status: 'incomplete',
    })
    const p5b = new Uint8Array(33)
    p5b[0] = 0x5b
    p5b[1] = 40
    expect(resolveStruct(p5b, 0)).toEqual({ status: 'incomplete' })
  })

  it('an already-framed single packet still sizes to its own length (no stream minimum)', () => {
    const p94 = [0x94, 0x00, 0x01, 0x00, 0x00, 0x00]
    expect(resolveFramedS2cPacketSize(new Uint8Array(p94))).toBe(6)
    expect(decodeD2gsS2cPacket(new Uint8Array(p94)).type).not.toBe('Opaque')
  })
})
