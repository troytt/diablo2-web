import { describe, expect, it } from 'vitest'
import { decodeD2gsS2cPacket } from '../../src/netproto/d2gs/registry.ts'
import { unitTypeToId, wireUnitTypeId } from '../../src/netproto/domain/ids.ts'

// #1656 (NET-4): every 1.13c D2Client unit lookup indexes the per-type hash table with the raw wire byte
// (`shl edx,9; add edx,0x6FBBA608` -> 0x6FB54E20, e.g. 0x6FB5C928 / 0x6FB5D6F3 / 0x6FB5F808) and the generic
// unit-packet dispatcher skips the unit handler when that lookup fails (0x6FB5CF0B..0x6FB5CF2A). A type outside
// 0..5 (D2Game uses 6 / 0xFFFFFFFF for "no unit") is never folded to the player type.

function pkt(bytes: number[]): Uint8Array {
  return new Uint8Array(bytes)
}
const ID = [0x07, 0x00, 0x00, 0x00]

function subjectPackets(type: number): Uint8Array[] {
  return [
    pkt([0x09, type, ...ID, 0x01, 0x10, 0x00, 0x20, 0x00]), // AssignWarp
    pkt([0x0a, type, ...ID]), // RemoveGroundUnit
    pkt([0x0b, type, ...ID]), // GameHandshake
    pkt([0x0c, type, ...ID, 0x13, 0x00, 0x40]), // NPCGetHit
    pkt([0x0d, type, ...ID, 0x00, 0x10, 0x00, 0x20, 0x00, 0x00, 0x40]), // PlayerStop
    pkt([0x0e, type, ...ID, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00]), // SetObjectState
    pkt([0x0f, type, ...ID, 0x01, 0x10, 0x00, 0x20, 0x00, 0x00, 0x10, 0x00, 0x20, 0x00]), // PlayerMove
    pkt([0x10, type, ...ID, 0x01, 0x01, ...ID, 0x10, 0x00, 0x20, 0x00]), // PlayerMoveToTarget
    pkt([0x15, type, ...ID, 0x10, 0x00, 0x20, 0x00, 0x00]), // ReassignPlayer
    pkt([0x21, type, 0x00, ...ID, 0x36, 0x00, 0x14, 0x00, 0x00]), // UpdateSkill
    pkt([0x2c, type, ...ID, 0x01, 0x00]), // PlaySound
    pkt([0x42, type, ...ID]), // ClearCursor
    pkt([0x4c, type, ...ID, 0x36, 0x00, 0x01, 0x01, ...ID, 0x00, 0x00]), // UnitUseSkillOnTarget
    pkt([0x4d, type, ...ID, 0x36, 0x00, 0x00, 0x00, 0x01, 0x10, 0x00, 0x20, 0x00, 0x00, 0x00]), // UnitUseSkill
    pkt([0x51, type, ...ID, 0x01, 0x00, 0x10, 0x00, 0x20, 0x00, 0x00, 0x00]), // AssignObject
    pkt([0x7c, type, ...ID]), // UseSpecialItem
    pkt([0x99, type, ...ID, 0x36, 0x00, 0x01, 0x01, ...ID, 0x00, 0x00]), // SkillTriggeredOnTarget
    pkt([0x9a, type, ...ID, 0x36, 0x00, 0x00, 0x00, 0x01, 0x10, 0x00, 0x20, 0x00, 0x00, 0x00]), // SkillTriggeredOnLocation
    pkt([0xa5, type, ...ID, 0x01, 0x00]), // StateSkillEffect
    pkt([0xa7, type, ...ID, 0x01]), // DelayedState
    pkt([0xa9, type, ...ID, 0x01]), // EndState
  ]
}

describe('#1656 raw wire unit types outside 0..5 never map to the player', () => {
  it('wireUnitTypeId keeps 0..5 and rejects everything else; unitTypeToId throws instead of folding', () => {
    for (let t = 0; t <= 5; t++) expect(wireUnitTypeId(t)).toBe(t)
    for (const t of [6, 7, 8, 0xff, -1]) {
      expect(wireUnitTypeId(t)).toBeUndefined()
      expect(() => unitTypeToId(t)).toThrow(RangeError)
    }
  })

  it('packets whose subject unit type is 6 or 7 have no effect (Opaque) instead of targeting player id 7', () => {
    for (const type of [6, 7]) {
      for (const p of subjectPackets(type)) {
        const ev = decodeD2gsS2cPacket(p)
        expect(ev.type, `opcode 0x${p[0]!.toString(16)} type ${type}`).toBe('Opaque')
      }
    }
  })

  it('the same packets with a valid type still decode to their domain event', () => {
    for (const p of subjectPackets(1)) {
      expect(decodeD2gsS2cPacket(p).type, `opcode 0x${p[0]!.toString(16)}`).not.toBe('Opaque')
    }
  })

  it('0x99 is dropped when the target type is invalid (second lookup 0x6FB5F12B); 0x10 keeps the move without a target', () => {
    expect(decodeD2gsS2cPacket(pkt([0x99, 0x01, ...ID, 0x36, 0x00, 0x01, 0x06, ...ID, 0x00, 0x00])).type).toBe('Opaque')
    const mv = decodeD2gsS2cPacket(pkt([0x10, 0x01, ...ID, 0x01, 0x06, 0xff, 0xff, 0xff, 0xff, 0x10, 0x00, 0x20, 0x00])) as any
    expect(mv.type).toBe('UnitMove')
    expect(mv.target).toBeUndefined()
  })

  it('0x22 ignores @1 (D2Client 0x6FB5C816 uses the player table only)', () => {
    const ev = decodeD2gsS2cPacket(pkt([0x22, 0x06, 0x00, ...ID, 0xdc, 0x00, 0x05, 0x00, 0x00])) as any
    expect(ev.type).toBe('SkillList')
    expect(ev.unitType).toBe(0)
  })

  it('0x16 MultipleUnitAssign skips entries with an invalid type', () => {
    const body = [0x01, ...ID, 0x10, 0x00, 0x20, 0x00, 0x06, ...ID, 0x10, 0x00, 0x20, 0x00]
    const size = 4 + body.length
    const ev = decodeD2gsS2cPacket(pkt([0x16, size & 0xff, size >> 8, 0x02, ...body])) as any
    expect(ev.entries).toEqual([{ unitType: 1, id: 7, x: 0x10, y: 0x20 }])
  })
})
