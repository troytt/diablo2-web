/**
 * Issue #1649: tempered quality (9) was treated as crafted in the required-level calculation.
 *
 * 1.13c ground truth (samples/d2/D2Common.dll, `objdump -d -M intel`): ITEMS_GetRequiredLevel 0x6fd76190
 * does `add eax,-4; cmp eax,4; ja 0x6fd764e2; jmp [eax*4+0x6fd766c0]` — the jump table covers qualities
 * 4..8 only, so quality 9 takes the default path (base levelreq, skills, stat 92) with no affix, automagic
 * or crafted `+10 + 3n` requirement.
 */
import { describe, expect, it } from 'vitest'
import { resolveOnlineItemReqLevel } from '../src/common/items/item-bridge.ts'

function ring(quality: number): Record<string, unknown> {
  return {
    code: 'rin',
    identified: true,
    container: 'inventory',
    quality,
    rareAffixes: [1, 1, 0, 0, 0, 0],
    autoAffixId: 0,
    stats: [],
  }
}

describe('issue #1649: tempered (9) is not crafted (D2Common 0x6fd76190 / 0x6fd766c0)', () => {
  it('crafted (8) still adds the crafted requirement', () => {
    expect(resolveOnlineItemReqLevel(ring(8))).toBeGreaterThanOrEqual(10)
  })

  it('tempered (9) only requires the base levelreq', () => {
    expect(resolveOnlineItemReqLevel(ring(9))).toBe(0)
    expect(resolveOnlineItemReqLevel({ ...ring(9), stats: [{ statId: 92, param: 0, value: 7 }] })).toBe(7)
  })
})
