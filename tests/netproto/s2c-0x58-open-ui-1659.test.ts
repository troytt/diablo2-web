import { describe, expect, it } from 'vitest'
import { decode0x58OpenUi } from '../../src/netproto/d2gs/s2c/misc.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

// #1659 (NET-7): D2Client 0x6FB5F980 copies 7 bytes to 0x6FB50250, which switches on u8 @5 (0..7; 2, 3 and
// > 7 are fatal at 0x6FB502DE) and uses only u32 @1 and u8 @6. No unit type, no legacy synthetic layout.
describe('#1659 S2C 0x58 canonical layout only', () => {
  it('a genuine "open orifice" whose id looks like the old synthetic layout is not re-decoded', () => {
    // @1 = 1, @4 = 0, @5 = 0 (open orifice), @6 = 7: the removed branch decoded this as uiId 7 / id 0x000700.
    const ev = decode0x58OpenUi(new Uint8Array([0x58, 0x01, 0x07, 0x00, 0x00, 0x00, 0x07])) as any
    expect(ev).toEqual({ type: 'OpenUi', unitId: 0x0701, uiId: 0, extra: 7 })
    expect(ev.unitType).toBeUndefined()
  })

  it('rejects the actions D2Client treats as fatal', () => {
    for (const action of [2, 3, 8, 0xff]) {
      expect(() => decode0x58OpenUi(new Uint8Array([0x58, 1, 0, 0, 0, action, 0]))).toThrow(RangeError)
    }
    expect(() => decode0x58OpenUi(new Uint8Array(6))).toThrow(RangeError)
  })

  it('wire actions 6/7 close the NPC UI (0x6FB502D4 -> 0x6FB4F9E0 / 0x6FAF8150) instead of opening a window', () => {
    for (const action of [6, 7]) {
      const w = new ClientWorld() as any
      w._npcInteraction = { ...w._npcInteraction, npcId: 42, window: 'npc', activeWindow: 'npc' }
      w.apply(decode0x58OpenUi(new Uint8Array([0x58, 42, 0, 0, 0, action, 0])))
      expect(w.npcInteraction.activeWindow).toBe('none')
    }
  })
})
