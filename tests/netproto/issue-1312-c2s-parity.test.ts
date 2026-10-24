import { describe, expect, it } from 'vitest'
import {
  C2S_PACKET_SIZES,
  encodeC2sAddSkillPoint,
  encodeC2sAddStatPoint,
  encodeC2sAssignSkillHotkey,
  encodeC2sHostile,
  encodeC2sNpcMercResurrect,
  encodeC2sPartyAction,
  encodeC2sPlayNpcMessage,
  encodeC2sResurrect,
  encodeClientCommand,
  validateC2sPacket,
} from '../../src/netproto/index.ts'

describe('Issue #1312 — 1.13c C2S opcodes & wire layouts (0x3A, 0x3B, 0x51, 0x41, 0x62, 0x5D, 0x5E, 0x4D)', () => {
  it('encodes 0x3A AddStatPoint (3B, D2Game.dll 0x6fcec960) with statId & 0x0f and countMinusOne clamped to 0..99', () => {
    const single = encodeC2sAddStatPoint(0)
    expect(Array.from(single)).toEqual([0x3a, 0x00, 0x00])
    expect(single.byteLength).toBe(C2S_PACKET_SIZES[0x3a])
    expect(() => validateC2sPacket(single)).not.toThrow()

    const fivePoints = encodeC2sAddStatPoint(2, 5)
    expect(Array.from(fivePoints)).toEqual([0x3a, 0x02, 0x04])

    // D2Game.dll 0x6fcec960 rejects count > 100 (countMinusOne > 99) with error 3
    const overMax = encodeC2sAddStatPoint(3, 250)
    expect(Array.from(overMax)).toEqual([0x3a, 0x03, 99])

    const cmdPkts = encodeClientCommand({ type: 'AddStatPoint', statId: 1, count: 10 })
    expect(cmdPkts).toHaveLength(1)
    expect(Array.from(cmdPkts[0]!)).toEqual([0x3a, 0x01, 0x09])
  })

  it('encodes 0x3B AddSkillPoint (3B, D2Game.dll 0x6fceca50) as u8 0x3B | u16LE skillId', () => {
    const pkt = encodeC2sAddSkillPoint(0x0123)
    expect(Array.from(pkt)).toEqual([0x3b, 0x23, 0x01])
    expect(pkt.byteLength).toBe(C2S_PACKET_SIZES[0x3b])
    expect(() => validateC2sPacket(pkt)).not.toThrow()

    const cmdPkts = encodeClientCommand({ type: 'AddSkillPoint', skillId: 54 })
    expect(cmdPkts).toHaveLength(1)
    expect(Array.from(cmdPkts[0]!)).toEqual([0x3b, 54, 0x00])
  })

  it('encodes 0x51 AssignSkillHotkey (9B, D2Client.dll 0x6faed260 / D2Game.dll 0x6fcebc70) with hand bit 15, slot 0..15, and unbind 0xffff', () => {
    const leftBind = encodeC2sAssignSkillHotkey(3, 'left', 54, 0x11223344)
    expect(Array.from(leftBind)).toEqual([0x51, 54, 0x80, 0x03, 0x00, 0x44, 0x33, 0x22, 0x11])
    expect(leftBind.byteLength).toBe(C2S_PACKET_SIZES[0x51])

    const rightBind = encodeC2sAssignSkillHotkey(7, 'right', 0x0105, 0xffffffff)
    expect(Array.from(rightBind)).toEqual([0x51, 0x05, 0x01, 0x07, 0x00, 0xff, 0xff, 0xff, 0xff])

    // Unbind via 0xffff, 0x7fff, or -1 emits 0xff, 0xff per D2Client.dll 0x6faed276
    expect(Array.from(encodeC2sAssignSkillHotkey(2, 'left', 0xffff))).toEqual([
      0x51, 0xff, 0xff, 0x02, 0x00, 0xff, 0xff, 0xff, 0xff,
    ])
    expect(Array.from(encodeC2sAssignSkillHotkey(2, 'right', 0x7fff))).toEqual([
      0x51, 0xff, 0xff, 0x02, 0x00, 0xff, 0xff, 0xff, 0xff,
    ])
    expect(Array.from(encodeC2sAssignSkillHotkey(2, 'left', -1))).toEqual([
      0x51, 0xff, 0xff, 0x02, 0x00, 0xff, 0xff, 0xff, 0xff,
    ])
  })

  it('encodes 0x41 Resurrect (1B), 0x62 NpcMercResurrect (5B), 0x5D Hostile (7B), 0x5E PartyAction (6B), and 0x4D PlayNpcMessage (3B)', () => {
    const pkt41 = encodeC2sResurrect()
    expect(Array.from(pkt41)).toEqual([0x41])
    expect(pkt41.byteLength).toBe(C2S_PACKET_SIZES[0x41])

    const pkt62 = encodeC2sNpcMercResurrect(0xdeadbeef)
    expect(Array.from(pkt62)).toEqual([0x62, 0xef, 0xbe, 0xad, 0xde])
    expect(pkt62.byteLength).toBe(C2S_PACKET_SIZES[0x62])

    const pkt5dOn = encodeC2sHostile(42, true)
    expect(Array.from(pkt5dOn)).toEqual([0x5d, 0x01, 0x01, 42, 0, 0, 0])
    const pkt5dOff = encodeC2sHostile(42, false)
    expect(Array.from(pkt5dOff)).toEqual([0x5d, 0x01, 0x00, 42, 0, 0, 0])
    const pkt5dLoot = encodeC2sHostile(42, true, 0x02)
    expect(Array.from(pkt5dLoot)).toEqual([0x5d, 0x02, 0x01, 42, 0, 0, 0])

    const pkt5e = encodeC2sPartyAction(0x06, 99)
    expect(Array.from(pkt5e)).toEqual([0x5e, 0x06, 99, 0, 0, 0])

    const pkt4d = encodeC2sPlayNpcMessage(148)
    expect(Array.from(pkt4d)).toEqual([0x4d, 148, 0])
    expect(pkt4d.byteLength).toBe(C2S_PACKET_SIZES[0x4d])
  })
})
