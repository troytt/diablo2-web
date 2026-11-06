import { describe, expect, it } from 'vitest'
import { decodeD2gsS2cPacket } from '../../src/netproto/d2gs/registry.ts'

function pkt73(tx: number, ty: number): Uint8Array {
  const p = new Uint8Array(32)
  const dv = new DataView(p.buffer)
  p[0] = 0x73
  dv.setUint16(5, 62, true)
  dv.setUint32(7, 5000, true)
  dv.setUint32(11, 5100, true)
  dv.setUint32(15, tx, true)
  dv.setUint32(19, ty, true)
  p[30] = 3
  return p
}

// D2Client.dll 0x6fb5ef3a..0x6fb5ef4c: target only when both coordinates are non-zero.
describe('S2C 0x73 CreateMissile target rule', () => {
  it('uses the target only when targetX and targetY are both non-zero', () => {
    expect(decodeD2gsS2cPacket(pkt73(5200, 5300))).toMatchObject({ target: { x: 5200, y: 5300 } })
    expect(decodeD2gsS2cPacket(pkt73(5200, 0))).toMatchObject({ target: { x: 5000, y: 5100 } })
    expect(decodeD2gsS2cPacket(pkt73(0, 5300))).toMatchObject({ target: { x: 5000, y: 5100 } })
  })
})
