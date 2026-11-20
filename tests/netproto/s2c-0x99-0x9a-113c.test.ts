import { describe, expect, it } from 'vitest'
import { decodeD2gsS2cPacket } from '../../src/netproto/d2gs/registry.ts'

// D2Game.dll 0x6fcad210 builds 0x4C and 0x99 with one byte layout; 0x6fc9ae67 builds 0x9A like 0x4D.
function skillOnTarget(op: number): Uint8Array {
  return new Uint8Array([
    op, 0x01, 0x78, 0x56, 0x34, 0x12, // caster monster 0x12345678
    0x2c, 0x00, // skill 44 (Frost Nova)
    0x07, // level
    0x00, 0x11, 0x00, 0x00, 0x00, // target player 0x11
    0x00, 0x00,
  ])
}

describe('S2C 0x99 / 0x9A triggered skills (1.13c)', () => {
  it('0x99 decodes with the 0x4C layout', () => {
    const a = decodeD2gsS2cPacket(skillOnTarget(0x99))
    const b = decodeD2gsS2cPacket(skillOnTarget(0x4c))
    expect(a).toMatchObject({
      type: 'SkillCast',
      caster: { unitType: 1, id: 0x12345678 },
      skill: 44,
      level: 7,
      target: { unitType: 0, id: 0x11 },
    })
    expect({ ...a, triggered: undefined }).toMatchObject({ ...b, triggered: undefined })
  })

  it('0x9A decodes with the 0x4D layout', () => {
    const pkt = (op: number) =>
      new Uint8Array([
        op, 0x00, 0x11, 0x00, 0x00, 0x00, // caster player 0x11
        0x35, 0x00, 0x00, 0x00, // skill 53 (Chain Lightning)
        0x05, // level
        0x10, 0x27, // x 10000
        0x20, 0x4e, // y 20000
        0x00, 0x00,
      ])
    const a = decodeD2gsS2cPacket(pkt(0x9a))
    expect(a).toMatchObject({
      type: 'SkillCast',
      caster: { unitType: 0, id: 0x11 },
      skill: 53,
      level: 5,
      target: { x: 10000, y: 20000 },
    })
    expect({ ...a, triggered: undefined }).toMatchObject({ ...decodeD2gsS2cPacket(pkt(0x4d)), triggered: undefined })
  })
})
