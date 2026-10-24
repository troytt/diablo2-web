/**
 * #808 — 1.13c D2Client 0x6fac43e0 SendPacket identical-packet dedupe (0x6fac4415..0x6fac4462).
 */
import { describe, expect, it } from 'vitest'
import {
  C2sIdenticalPacketDedupe113c,
  c2sIdenticalDedupeWindowMs113c,
} from '../../src/client/session/c2s-identical-dedupe-113c.ts'
import type { ClientCommand } from '../../src/netproto/domain/client-command.ts'

const skillOn = (id: number, hold = false): ClientCommand => ({
  type: 'SkillOn',
  hand: 'left',
  target: { unitType: 'monster', id },
  shift: false,
  hold,
})
const skillAt = (x: number, y: number, hold = false): ClientCommand => ({
  type: 'SkillAt',
  hand: 'right',
  at: { x, y },
  hold,
})

describe('c2sIdenticalDedupeWindowMs113c (jump table 0x6fac44cc/0x6fac44d8)', () => {
  it('skill opcodes 0x05..0x0A and 0x0C..0x11 use 50 ms (0x6fac443b)', () => {
    for (const op of [0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11]) {
      expect(c2sIdenticalDedupeWindowMs113c(op)).toBe(50)
    }
  })
  it('0x0B, 0x12..0x39, walk/run 0x01..0x04 and every op outside 0x05..0x3A use 200 ms (0x6fac4446)', () => {
    for (const op of [0x01, 0x02, 0x03, 0x04, 0x0b, 0x12, 0x13, 0x15, 0x39, 0x3b, 0x3c, 0x5f, 0x6d]) {
      expect(c2sIdenticalDedupeWindowMs113c(op)).toBe(200)
    }
  })
  it('0x3A is never deduped (0x6fac4462)', () => {
    expect(c2sIdenticalDedupeWindowMs113c(0x3a)).toBeNull()
  })
})

describe('C2sIdenticalPacketDedupe113c', () => {
  it('drops a byte-identical skill packet inside 50 ms and admits it at 50 ms', () => {
    const d = new C2sIdenticalPacketDedupe113c()
    expect(d.admitCommand(skillOn(7), 1000)).toBe(true)
    expect(d.admitCommand(skillOn(7), 1049)).toBe(false)
    // `jae` -> exactly 50 ms elapsed is sent; the drop did not refresh the slot tick.
    expect(d.admitCommand(skillOn(7), 1050)).toBe(true)
    expect(d.droppedCount).toBe(1)
  })

  it('different bytes are never deduped (other target / hold opcode / location)', () => {
    const d = new C2sIdenticalPacketDedupe113c()
    expect(d.admitCommand(skillOn(7), 0)).toBe(true)
    expect(d.admitCommand(skillOn(8), 1)).toBe(true)
    expect(d.admitCommand(skillOn(8, true), 2)).toBe(true) // 0x09 != 0x06
    expect(d.admitCommand(skillAt(10, 10), 3)).toBe(true)
    expect(d.admitCommand(skillAt(10, 11), 4)).toBe(true)
  })

  it('walk/run packets use the 200 ms window', () => {
    const d = new C2sIdenticalPacketDedupe113c()
    const walk: ClientCommand = { type: 'Move', run: true, to: { x: 5000, y: 5001 } }
    expect(d.admitCommand(walk, 0)).toBe(true)
    expect(d.admitCommand(walk, 199)).toBe(false)
    expect(d.admitCommand(walk, 200)).toBe(true)
  })

  it('single shared slot: any different packet in between breaks the dedupe', () => {
    const d = new C2sIdenticalPacketDedupe113c()
    expect(d.admitCommand(skillOn(7), 0)).toBe(true)
    expect(d.admitCommand({ type: 'Move', run: false, to: { x: 1, y: 2 } }, 10)).toBe(true)
    // Slot now holds the walk packet, so the identical skill packet is sent again.
    expect(d.admitCommand(skillOn(7), 20)).toBe(true)
    // And now the slot holds the skill packet again.
    expect(d.admitCommand(skillOn(7), 30)).toBe(false)
  })

  it('0x3A AddStatPoint is never deduped but still updates the shared slot', () => {
    const d = new C2sIdenticalPacketDedupe113c()
    const stat: ClientCommand = { type: 'AddStatPoint', statId: 0, count: 1 }
    expect(d.admitCommand(stat, 0)).toBe(true)
    expect(d.admitCommand(stat, 1)).toBe(true)
    expect(d.admitCommand(stat, 2)).toBe(true)
    expect(d.admitCommand(skillOn(7), 3)).toBe(true)
    expect(d.admitCommand(stat, 4)).toBe(true)
    expect(d.admitCommand(skillOn(7), 5)).toBe(true) // slot was overwritten by 0x3A
  })

  it('a clock that goes backwards behaves like the unsigned compare (sends)', () => {
    const d = new C2sIdenticalPacketDedupe113c()
    expect(d.admitCommand(skillOn(7), 1000)).toBe(true)
    expect(d.admitCommand(skillOn(7), 900)).toBe(true)
  })

  it('Ping is not part of the D2GS SendPacket path and is always admitted', () => {
    const d = new C2sIdenticalPacketDedupe113c()
    expect(d.admitCommand({ type: 'Ping' } as ClientCommand, 0)).toBe(true)
    expect(d.admitCommand({ type: 'Ping' } as ClientCommand, 1)).toBe(true)
  })

  it('admitPacket rejects empty packets and invalid clocks', () => {
    const d = new C2sIdenticalPacketDedupe113c()
    expect(() => d.admitPacket(new Uint8Array(0), 0)).toThrow(RangeError)
    expect(() => d.admitPacket(new Uint8Array([0x06]), Number.NaN)).toThrow(RangeError)
  })
})
