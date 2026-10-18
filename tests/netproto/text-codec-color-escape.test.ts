import { describe, expect, it } from 'vitest'
import { defaultTextCodec } from '../../src/netproto/core/text-codec.ts'
import { parseColoredText } from '../../src/client/ui/font.ts'

describe('GBK decode keeps D2 colour escapes', () => {
  it('decodes 0xFF as the colour marker so the colour parser sees it', () => {
    const bytes = new Uint8Array([0xff, 0x63, 0x38, ...new TextEncoder().encode('[D2GS] hello')])
    const text = defaultTextCodec.decode(bytes)
    expect(text).toBe('\xffc8[D2GS] hello')
    expect(parseColoredText(text)).toEqual([{ text: '[D2GS] hello', color: 'orange' }])
  })

  it('still decodes GBK characters around colour escapes', () => {
    const gbkNi = [0xc4, 0xe3]
    const text = defaultTextCodec.decode(new Uint8Array([...gbkNi, 0xff, 0x63, 0x31, ...gbkNi]))
    expect(text).toBe('你\xffc1你')
  })
})
