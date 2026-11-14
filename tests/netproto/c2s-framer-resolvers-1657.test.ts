import { describe, expect, it } from 'vitest'
import { encodeC2sChat, encodeC2sOverheadChat, resolveC2sPacketSize } from '../../src/netproto/index.ts'

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0))

// #1657 (NET-5): exact ports of the D2NET_10006 (0x6FBF65D0) variable-length cases.
describe('#1657 C->S variable-length resolvers (D2NET_10006)', () => {
  it('0x6C (case 0x6FBF66AB): waits for 6 bytes, size = u8 @1 + 7', () => {
    const p = new Uint8Array(17)
    p[0] = 0x6c
    p[1] = 10
    expect(resolveC2sPacketSize(p.subarray(0, 5), 0)).toBeNull()
    expect(resolveC2sPacketSize(p.subarray(0, 16), 0)).toBeNull()
    expect(resolveC2sPacketSize(p, 0)).toBe(17)
  })

  it('0x66 (case 0x6FBF6688): payload length above 0x1FD counts as 0', () => {
    expect(resolveC2sPacketSize(new Uint8Array([0x66, 0x04, 0x00, 1, 2, 3, 4]), 0)).toBe(7)
    expect(resolveC2sPacketSize(new Uint8Array([0x66, 0xfd, 0x01]), 0)).toBeNull() // 0x1FD + 3 needs 512 bytes
    expect(resolveC2sPacketSize(new Uint8Array([0x66, 0xfe, 0x01]), 0)).toBe(3) // 0x1FE -> 0
    expect(resolveC2sPacketSize(new Uint8Array([0x66, 0xff, 0xff]), 0)).toBe(3)
  })

  it('0x14/0x15 (case 0x6FBF663A): 3 + (strlen(s1)+1) + (strlen(s2)+1) + 1 + (int8)b', () => {
    // 0x14 with a non-empty second string and b = 2 trailing bytes.
    const p14 = [0x14, 0x00, 0x00, ...ascii('hi'), 0, ...ascii('ab'), 0, 0x02, 0xaa, 0xbb]
    expect(resolveC2sPacketSize(new Uint8Array(p14), 0)).toBe(p14.length)
    expect(resolveC2sPacketSize(new Uint8Array(p14.slice(0, -1)), 0)).toBeNull()
    // 0x15 with b = 1.
    const p15 = [0x15, 0x01, 0x00, ...ascii('yo'), 0, 0, 0x01, 0xcc]
    expect(resolveC2sPacketSize(new Uint8Array(p15), 0)).toBe(p15.length)
    // b is signed: -1 makes the packet end one byte before b.
    const pNeg = [0x15, 0x01, 0x00, ...ascii('yo'), 0, 0, 0xff]
    expect(resolveC2sPacketSize(new Uint8Array(pNeg), 0)).toBe(pNeg.length - 1)
    // Incomplete strings wait for more data.
    expect(resolveC2sPacketSize(new Uint8Array([0x14, 0, 0, 0x41]), 0)).toBeNull()
    expect(resolveC2sPacketSize(new Uint8Array([0x14, 0, 0, 0x41, 0]), 0)).toBeNull()
  })

  it('the client encoders produce packets the exact resolver accepts', () => {
    const oh = encodeC2sOverheadChat('Taunt!')
    expect(resolveC2sPacketSize(oh, 0)).toBe(oh.length)
    const ch = encodeC2sChat('Hello world', 'Deckard')
    expect(resolveC2sPacketSize(ch, 0)).toBe(ch.length)
  })
})
