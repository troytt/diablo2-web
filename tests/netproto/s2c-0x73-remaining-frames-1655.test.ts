import { describe, expect, it } from 'vitest'
import { decode0x73CreateMissile } from '../../src/netproto/index.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

function pkt73(opts: { remaining: number; level: number; pierce: number; classId?: number }): Uint8Array {
  const p = new Uint8Array(32)
  const dv = new DataView(p.buffer)
  p[0] = 0x73
  dv.setUint16(5, opts.classId ?? 62, true) // fireball
  dv.setUint32(7, 5000, true)
  dv.setUint32(11, 5000, true)
  dv.setUint32(15, 5040, true)
  dv.setUint32(19, 5040, true)
  dv.setUint16(23, opts.remaining & 0xffff, true)
  p[25] = 0
  dv.setUint32(26, 1, true)
  p[30] = opts.level
  p[31] = opts.pierce
  return p
}

// #1655 (NET-3) / #1664 (NET-U1): @0x17 is missile data +0x10, the frame countdown. D2Game sets +0x0E (range)
// and +0x10 to the same value at creation (0x6FC8FCCF / 0x6FC8FCD6), decrements +0x10 every tick
// (0x6FC5F39E..0x6FC5F3A8) and D2Common 0x6FDBA240 returns elapsed = +0x0E - +0x10. D2Client 0x6FB5EF83 pushes
// the word zero-extended into D2Common #10970 (0x6FDBA6D0), which clamps to 0x7FFF.
describe('#1655 S2C 0x73 remaining frames, pierce_idx and raw level', () => {
  it('decodes @0x17 as remaining frames (clamped like #10970), @0x1E raw and @0x1F as pierce_idx', () => {
    const ev = decode0x73CreateMissile(pkt73({ remaining: 30, level: 0, pierce: 2 })) as any
    expect(ev.remainingFrames).toBe(30)
    expect(ev.level).toBe(0)
    expect(ev.pierceIdx).toBe(2)
    expect(ev.velocity).toBeUndefined()
    expect(ev.range).toBeUndefined()
    // 0xFFFF zero-extended is > 0x7FFF -> stored as 0x7FFF.
    expect((decode0x73CreateMissile(pkt73({ remaining: 0xffff, level: 1, pierce: 0 })) as any).remainingFrames).toBe(0x7fff)
  })

  it('the client missile keeps its range and starts at elapsed = range - remaining', () => {
    const w = new ClientWorld() as any
    w.apply(decode0x73CreateMissile(pkt73({ remaining: 5, level: 3, pierce: 0 })))
    const missiles = [...w.units.values()].filter((u: any) => u.unitType === 'missile')
    expect(missiles).toHaveLength(1)
    const m = missiles[0]
    expect(m.skillLevel).toBe(3)
    expect(m.maxTicks - m.ageTicks).toBe(5)
  })

  it('level 0 is passed through to the missile (D2Client 0x6FB5EF1E, range = Range + LevRange * 0)', () => {
    const w = new ClientWorld() as any
    w.apply(decode0x73CreateMissile(pkt73({ remaining: 0, level: 0, pierce: 0 })))
    const m = [...w.units.values()].find((u: any) => u.unitType === 'missile')
    expect(m.skillLevel).toBe(0)
  })
})
