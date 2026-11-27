/**
 * #808 — C->S skill opcode table parity with 1.13c D2Client 0x6faca060 SendSkillPacket(bOnUnit, ClickInfo*).
 *
 * Unit: L 0x06 / shift 0x07 / hold 0x09 / shift+hold 0x0A; R 0x0D / 0x0E / 0x10 / 0x11.
 * Location: L 0x05 / hold 0x08; R 0x0C / hold 0x0F — no shift variant (0x08/0x0F mean "held").
 */
import { describe, expect, it } from 'vitest'
import {
  c2sSkillAtOpcode,
  c2sSkillOnUnitOpcode,
  encodeC2sSkillAt,
  encodeC2sSkillOnUnit,
} from '../../src/netproto/d2gs/c2s/skills.ts'
import { encodeD2gsClientCommand } from '../../src/netproto/d2gs/registry.ts'
import { C2S_PACKET_SIZES } from '../../src/netproto/d2gs/tables/s2c-sizes.ts'
import type { ClientCommand } from '../../src/netproto/domain/client-command.ts'

function only(cmd: ClientCommand): Uint8Array {
  const pkts = encodeD2gsClientCommand(cmd)
  expect(pkts).toHaveLength(1)
  return pkts[0]!
}

describe('1.13c D2Client 0x6faca060 SendSkillPacket opcode table', () => {
  it.each([
    // [hand, shift, hold, opcode, 1.13c site]
    ['left', false, false, 0x06, '0x6faca3ab'],
    ['left', true, false, 0x07, '0x6faca25d'],
    ['left', false, true, 0x09, '0x6faca35e'],
    ['left', true, true, 0x0a, '0x6faca15f'],
    ['right', false, false, 0x0d, '0x6faca70b'],
    ['right', true, false, 0x0e, '0x6faca519'],
    ['right', false, true, 0x10, '0x6faca61a'],
    ['right', true, true, 0x11, '0x6faca470'],
  ] as const)('unit %s shift=%s hold=%s -> 0x%s (%s)', (hand, shift, hold, opcode, _site) => {
    expect(c2sSkillOnUnitOpcode(hand, shift, hold)).toBe(opcode)
    const pkt = only({ type: 'SkillOn', hand, target: { unitType: 1, id: 0x1234 }, shift, hold })
    expect(Array.from(pkt)).toEqual([opcode, 1, 0, 0, 0, 0x34, 0x12, 0, 0])
    expect(pkt.length).toBe(C2S_PACKET_SIZES[opcode])
    expect(pkt.length).toBe(9)
  })

  it.each([
    // [hand, hold, opcode, 1.13c site]
    ['left', false, 0x05, '0x6faca886'],
    ['left', true, 0x08, '0x6faca838'],
    ['right', false, 0x0c, '0x6facaa4a'],
    ['right', true, 0x0f, '0x6faca94f'],
  ] as const)('location %s hold=%s -> 0x%s (%s)', (hand, hold, opcode, _site) => {
    expect(c2sSkillAtOpcode(hand, hold)).toBe(opcode)
    const pkt = only({ type: 'SkillAt', hand, at: { x: 0x13f6, y: 0x1452 }, hold })
    expect(Array.from(pkt)).toEqual([opcode, 0xf6, 0x13, 0x52, 0x14])
    expect(pkt.length).toBe(C2S_PACKET_SIZES[opcode])
    expect(pkt.length).toBe(5)
  })

  it('location packets have no shift variant: the old shift-only opcodes 0x08/0x0F are hold repeats', () => {
    // A shifted location press (stand-still cast) is still 0x05 / 0x0C on the wire.
    expect(encodeC2sSkillAt('left', { x: 1, y: 2 }, false)[0]).toBe(0x05)
    expect(encodeC2sSkillAt('right', { x: 1, y: 2 }, false)[0]).toBe(0x0c)
    expect(encodeC2sSkillAt('left', { x: 1, y: 2 }, true)[0]).toBe(0x08)
    expect(encodeC2sSkillAt('right', { x: 1, y: 2 }, true)[0]).toBe(0x0f)
  })

  it('CastLeftSkillOnLocation is a press (0x05), CastRightSkillOnLocation 0x0C, TownPortal 0x0C', () => {
    expect(only({ type: 'CastLeftSkillOnLocation', x: 10, y: 20 })[0]).toBe(0x05)
    expect(only({ type: 'CastRightSkillOnLocation', x: 10, y: 20 })[0]).toBe(0x0c)
    expect(Array.from(only({ type: 'TownPortal' } as ClientCommand))).toEqual([0x0c, 0, 0, 0, 0])
  })

  it('CastLeft/RightSkillOnTarget are non-shift press opcodes 0x06/0x0D', () => {
    expect(only({ type: 'CastLeftSkillOnTarget', unitKind: 'monster', unitId: 7 })[0]).toBe(0x06)
    expect(only({ type: 'CastRightSkillOnTarget', unitKind: 'monster', unitId: 7 })[0]).toBe(0x0d)
  })

  it('fails fast when hold/shift are missing (no silent default)', () => {
    expect(() => encodeC2sSkillAt('left', { x: 1, y: 1 }, undefined as unknown as boolean)).toThrow(/hold/)
    expect(() =>
      encodeC2sSkillOnUnit('left', { unitType: 1, id: 1 }, undefined as unknown as boolean, false),
    ).toThrow(/shift/)
    expect(() =>
      encodeC2sSkillOnUnit('right', { unitType: 1, id: 1 }, false, undefined as unknown as boolean),
    ).toThrow(/hold/)
    expect(() =>
      encodeD2gsClientCommand({ type: 'SkillAt', hand: 'left', at: { x: 1, y: 1 } } as unknown as ClientCommand),
    ).toThrow(/hold/)
    expect(() =>
      encodeD2gsClientCommand({
        type: 'SkillOn',
        hand: 'left',
        target: { unitType: 1, id: 1 },
      } as unknown as ClientCommand),
    ).toThrow(/shift|hold/)
  })
})
