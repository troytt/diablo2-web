import { describe, expect, it } from 'vitest'
import { decode0x21UpdateSkill, decode0x22UpdateSkillStatus } from '../../src/netproto/index.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

function pkt22(opts: { id: number; skill: number; qty: number; skip: number; garbage2?: number; garbageA?: number }): Uint8Array {
  const p = new Uint8Array(12)
  const dv = new DataView(p.buffer)
  p[0] = 0x22
  p[1] = 0
  p[2] = opts.garbage2 ?? 0
  dv.setUint32(3, opts.id, true)
  dv.setUint16(7, opts.skill, true)
  p[9] = opts.qty
  p[10] = opts.garbageA ?? 0
  p[11] = opts.skip
  return p
}

// #1654 (NET-2): D2Game 0x6FCAD570 writes @0xB = (unit has state 7 `playerbody`) and leaves @2/@0xA
// uninitialized; D2Client 0x6FB5C800 returns immediately when @0xB != 0.
describe('#1654 S2C 0x22 playerbody skip byte and 0x21 padding', () => {
  it('0x22 with @0xB != 0 carries no skill quantity and is flagged playerBodySkip', () => {
    const ev = decode0x22UpdateSkillStatus(pkt22({ id: 7, skill: 220, qty: 3, skip: 1 })) as any
    expect(ev.type).toBe('SkillList')
    expect(ev.playerBodySkip).toBe(true)
    expect(ev.skills).toEqual([])
  })

  it('0x22 ignores the uninitialized bytes @2 and @0xA', () => {
    const ev = decode0x22UpdateSkillStatus(pkt22({ id: 7, skill: 220, qty: 3, skip: 0, garbage2: 0xcc, garbageA: 0xcc })) as any
    expect(ev.playerBodySkip).toBe(false)
    expect(ev.flag).toBeUndefined()
    expect(ev.skills).toEqual([{ skillId: 220, level: 3, quantity: 3 }])
  })

  it('0x21 flag is only @2 (D2Client 0x6FB5C910 -> 0x6FABC550); padding @10/@11 is ignored', () => {
    const p = new Uint8Array([0x21, 0x00, 0x00, 0x0a, 0x00, 0x00, 0x00, 0x36, 0x00, 0x14, 0xcc, 0xcc])
    expect((decode0x21UpdateSkill(p) as any).flag).toBe(0)
    p[2] = 1
    expect((decode0x21UpdateSkill(p) as any).flag).toBe(1)
  })

  it('the world applier keeps the previous charge count when the packet is skipped', () => {
    const w = new ClientWorld() as any
    w.apply(decode0x22UpdateSkillStatus(pkt22({ id: 7, skill: 220, qty: 5, skip: 0 })))
    expect(w._self.skillCharges.get(220)).toBe(5)
    w.apply(decode0x22UpdateSkillStatus(pkt22({ id: 7, skill: 220, qty: 0, skip: 1 })))
    expect(w._self.skillCharges.get(220)).toBe(5)
  })
})
