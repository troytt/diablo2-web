import { describe, expect, it } from 'vitest'
import { wrapSpeechText } from '../../src/client/ui/world-panels.ts'

const font = { measureText: (text: string) => text.length * 7 }

describe('NPC speech wrapping', () => {
  it('reflows English lines that were broken for another language, keeping paragraph breaks', () => {
    const text = "Hi there. I'm Charsi, the blacksmith here\nin camp.\n\nMany of our Sisters fought bravely\nagainst Diablo."
    expect(wrapSpeechText(font, text, 200)).toEqual(["Hi there. I'm Charsi, the", 'blacksmith here in camp.', '', 'Many of our Sisters fought', 'bravely against Diablo.'])
  })

  it('keeps the hand-placed breaks of Chinese text', () => {
    expect(wrapSpeechText(font, '如果你無法殺死血鳥\n就再也不存在了。', 200)).toEqual(['如果你無法殺死血鳥', '就再也不存在了。'])
  })
})
