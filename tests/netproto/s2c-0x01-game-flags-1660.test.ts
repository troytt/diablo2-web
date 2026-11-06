import { describe, expect, it } from 'vitest'
import { decodeD2gsS2cPacket } from '../../src/netproto/d2gs/registry.ts'

function pkt01(difficulty: number, arenaFlags: number, expansion = 1, ladder = 0): Uint8Array {
  const p = new Uint8Array(8)
  p[0] = 0x01
  p[1] = difficulty
  new DataView(p.buffer).setUint32(2, arenaFlags >>> 0, true)
  p[6] = expansion
  p[7] = ladder
  return p
}

// #1660 (NET-8) / #1665 (NET-U2): D2Client 0x6FB5FA90 stores @1 unclamped; the dword @2 is D2Game's arena flags
// (builder 0x6FCAC420: [[pGame+0x1D28]+8] = create flags & 0x3179C7). D2Game treats 0x800 as the hardcore game
// flag when admitting characters (`test ah,0x8` at 0x6FC6BDC2 / 0x6FD0BB9D).
describe('#1660 S2C 0x01 difficulty and hardcore flag', () => {
  it('passes difficulty 0..2 through and fails fast on anything else', () => {
    for (const d of [0, 1, 2]) expect((decodeD2gsS2cPacket(pkt01(d, 0)) as any).difficulty).toBe(d)
    expect(() => decodeD2gsS2cPacket(pkt01(3, 0))).toThrow(RangeError)
    expect(() => decodeD2gsS2cPacket(pkt01(0xff, 0))).toThrow(RangeError)
  })

  it('hardcore is arena flag 0x800 and the raw arena flags are exposed', () => {
    const hc = decodeD2gsS2cPacket(pkt01(1, 0x00000804, 1, 1)) as any
    expect(hc).toMatchObject({ type: 'GameFlags', difficulty: 1, hardcore: true, expansion: true, ladder: true })
    expect(hc.arenaFlags).toBe(0x804)
    expect((decodeD2gsS2cPacket(pkt01(1, 0x00000004)) as any).hardcore).toBe(false)
  })
})
