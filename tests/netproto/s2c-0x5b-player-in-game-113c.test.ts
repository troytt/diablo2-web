import { describe, expect, it } from 'vitest'
import { decodeD2gsS2cPacket } from '../../src/netproto/d2gs/registry.ts'

function pkt5b(suffix: string, suffix2: string, relation: number): Uint8Array {
  const tail = [...suffix].map((c) => c.charCodeAt(0)).concat([0], [...suffix2].map((c) => c.charCodeAt(0)), [0])
  const len = 0x22 + tail.length
  const b = new Uint8Array(len)
  const dv = new DataView(b.buffer)
  b[0] = 0x5b
  dv.setUint16(1, len, true)
  dv.setUint32(3, 0x42, true)
  b[7] = 3
  b.set([...'Hero'].map((c) => c.charCodeAt(0)), 8)
  dv.setUint16(0x18, 30, true)
  dv.setUint16(0x1a, 0xffff, true)
  dv.setUint16(0x1c, 0x1111, true)
  dv.setUint16(0x1e, relation, true)
  dv.setUint16(0x20, 0x2222, true)
  b.set(tail, 0x22)
  return b
}

// D2Client.dll 0x6fb5d8f0 -> 0x6fb4e3d0 -> 0x6fb4d310 (roster fill) / 0x6fb4d37c ("%s {%s}").
describe('S2C 0x5B PlayerInGame trailing fields', () => {
  it('decodes relation @0x1E, word @0x20 and the two strings', () => {
    expect(decodeD2gsS2cPacket(pkt5b('', '', 0))).toMatchObject({
      unitId: 0x42,
      charClass: 3,
      charName: 'Hero',
      charLevel: 30,
      partyId: 0xffff,
      relation: 0,
      rosterWord44: 0x2222,
      nameSuffix: '',
      displayName: 'Hero',
    })
    expect(decodeD2gsS2cPacket(pkt5b('abc', 'x', 2))).toMatchObject({
      relation: 2,
      nameSuffix: 'abc',
      nameSuffix2: 'x',
      displayName: 'Hero {abc}',
    })
  })
})
