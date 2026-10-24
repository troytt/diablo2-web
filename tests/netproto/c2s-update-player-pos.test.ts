/**
 * C2S 0x5F UpdatePlayerPos (D2 1.13c): `u8 0x5F | u16 x | u16 y`, sent by D2Client 0x6FAC49E0 when
 * the position gate 0x6FADA1B0 finds the local player out of tolerance.
 */

import { describe, expect, it } from 'vitest'
import { encodeC2sUpdatePlayerPos } from '../../src/netproto/d2gs/c2s/position.ts'
import { encodeD2gsClientCommand } from '../../src/netproto/d2gs/registry.ts'

describe('C2S 0x5F UpdatePlayerPos', () => {
  it('encodes the sub-tile as two little-endian u16 values', () => {
    expect([...encodeC2sUpdatePlayerPos(0x1234, 0xbeef)]).toEqual([0x5f, 0x34, 0x12, 0xef, 0xbe])
    expect([...encodeC2sUpdatePlayerPos(0, 0xffff)]).toEqual([0x5f, 0x00, 0x00, 0xff, 0xff])
  })

  it('is what the UpdatePlayerPos client command sends', () => {
    const packets = encodeD2gsClientCommand({ type: 'UpdatePlayerPos', x: 5000, y: 4999 })
    expect(packets.map(p => [...p])).toEqual([[0x5f, 0x88, 0x13, 0x87, 0x13]])
  })

  it('rejects coordinates that are not u16', () => {
    for (const bad of [-1, 0x10000, 1.5, Number.NaN]) {
      expect(() => encodeC2sUpdatePlayerPos(bad, 100)).toThrow(RangeError)
      expect(() => encodeC2sUpdatePlayerPos(100, bad)).toThrow(RangeError)
    }
  })
})
