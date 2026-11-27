import { describe, expect, it } from 'vitest'
import { decode0x26ChatMessage } from '../../src/netproto/d2gs/s2c/chat.ts'

function pkt26(name: string, msg: string): Uint8Array {
  const head = [0x26, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00]
  const enc = (s: string) => [...Array.from(s, (c) => c.charCodeAt(0)), 0]
  return new Uint8Array([...head, ...enc(name), ...enc(msg)])
}

// #1662 (NET-10): D2Client 0x6FB5F9F0 copies the name with a 16-byte bound (`push 0x10` -> Storm #501 SStrCopy,
// which keeps max-1 bytes) and the message, located after the name's full length, with a 256-byte bound.
describe('#1662 S2C 0x26 name/message bounds', () => {
  it('keeps at most 15 name bytes and 255 message bytes', () => {
    const longName = 'N'.repeat(20)
    const longMsg = 'm'.repeat(300)
    const ev = decode0x26ChatMessage(pkt26(longName, longMsg), 'latin1') as any
    expect(ev.from).toBe('N'.repeat(15))
    expect(ev.text).toBe('m'.repeat(255))
  })

  it('short strings are unchanged', () => {
    const ev = decode0x26ChatMessage(pkt26('Deckard', 'Stay awhile'), 'latin1') as any
    expect(ev.from).toBe('Deckard')
    expect(ev.text).toBe('Stay awhile')
  })
})
