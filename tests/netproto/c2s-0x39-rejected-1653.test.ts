import { describe, expect, it } from 'vitest'
import {
  C2S_PACKET_SIZES,
  D2gsC2sFramer,
  ProtocolError,
  encodeC2sPlayNpcMessage,
  encodeClientCommand,
  resolveC2sPacketSize,
  validateC2sPacket,
} from '../../src/netproto/index.ts'
import { D2GAME_REJECTED_C2S_OPCODES } from '../../src/netproto/d2gs/framing-c2s.ts'

// #1653 (NET-1): C->S 0x39 is a fixed 5-byte D2Net entry (0x6FBFABD8 + 0x39*4 = 5, no special case in
// D2NET_10006 0x6FBF65D0) and its D2Game handler 0x6FCEB560 is `mov eax,3; ret 8` (always rejected).
describe('#1653 C->S 0x39 framing and D2Game always-rejected opcodes', () => {
  it('frames 0x39 as the fixed table size 5 regardless of how many bytes are buffered', () => {
    expect(C2S_PACKET_SIZES[0x39]).toBe(5)
    const nine = new Uint8Array([0x39, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(resolveC2sPacketSize(nine, 0)).toBe(5)
    expect(resolveC2sPacketSize(new Uint8Array([0x39, 1, 2, 3]), 0)).toBeNull()

    // A stream of 0x39 (5B) followed by 0x4D (3B) splits at 5, not 9.
    const framer = new D2gsC2sFramer()
    const out = framer.push(new Uint8Array([0x39, 1, 2, 3, 4, 0x4d, 0x94, 0x00]))
    expect(out.map((p) => p.byteLength)).toEqual([5, 3])
    expect(framer.bufferedBytes).toBe(0)
  })

  it('never encodes 0x39: PlayNpcMessage is always the 3-byte 0x4D', () => {
    expect(Array.from(encodeC2sPlayNpcMessage(148))).toEqual([0x4d, 0x94, 0x00])
    expect(Array.from(encodeC2sPlayNpcMessage({ classId: 148 }))).toEqual([0x4d, 0x94, 0x00])
    const pkts = encodeClientCommand({ type: 'PlayNpcMessage', classId: 148 })
    expect(pkts.map((p) => Array.from(p))).toEqual([[0x4d, 0x94, 0x00]])
    expect(() => encodeC2sPlayNpcMessage({})).toThrow(RangeError)
  })

  it('validateC2sPacket rejects every opcode whose D2Game handler always returns 3 (0x2C/0x2D/0x39/0x45/0x52)', () => {
    expect([...D2GAME_REJECTED_C2S_OPCODES].sort((a, b) => a - b)).toEqual([0x2c, 0x2d, 0x39, 0x45, 0x52])
    // D2Net C->S sizes (0x6FBFABD8): 0x2C = 0 (never framed), 0x2D = 1, 0x39 = 5, 0x45 = 9, 0x52 = 5.
    expect([0x2c, 0x2d, 0x39, 0x45, 0x52].map((op) => C2S_PACKET_SIZES[op])).toEqual([0, 1, 5, 9, 5])
    for (const op of D2GAME_REJECTED_C2S_OPCODES) {
      const size = C2S_PACKET_SIZES[op]!
      const pkt = new Uint8Array(Math.max(1, size))
      pkt[0] = op
      if (size > 0) {
        // D2Net still frames it with its fixed size...
        expect(resolveC2sPacketSize(pkt, 0)).toBe(size)
      }
      // ...but the client must never emit it.
      expect(() => validateC2sPacket(pkt)).toThrow(ProtocolError)
    }
  })
})
