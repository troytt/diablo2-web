/**
 * S2C unit-state packets as the 1.13c quest special lights need them (#826): D2Client 0xA8 SetState
 * (0x6fb5dd70) reaches the state set-function dispatch 0x6fb22530 only after the 0x1ff stat terminator
 * (0x6fb5dea3); 0xAA AddUnitState (0x6fb5db90) sets every state of its bitstream and dispatches after
 * each (0x6fb5dcfa), and a stat bail-out ends the packet. 0xA5 / 0xA7 carry no stats.
 *
 * The first four packets are real 1.13c D2GS captures (state 105 with stat 172 alignment).
 */

import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { getCanonicalItemDataTables } from '../../src/client/world/item-tables-provider.ts'
import { decodeD2gsS2cPacket, type ServerEvent } from '../../src/netproto/index.ts'
import { packet0xA5, packet0xA7, packet0xA8, packet0xAA } from '../fixtures/lighting/state-packets.ts'

const CLOAK_OF_SHADOWS = 153
const MODIFIERLIST_SKILL = 350
const MODIFIERLIST_LEVEL = 351
/** ItemStatCost `questitemdifficulty`: Send Bits 0, a bail-out of the stat loop (0x6fb5ddc6-92). */
const STAT_SEND_BITS_0 = 356
/** First ItemStatCost id past the 1.13c table (359 rows): a bail-out of the stat loop. */
const STAT_UNKNOWN = 359

function decode(pkt: Uint8Array): ServerEvent {
  return decodeD2gsS2cPacket(pkt, { tables: getCanonicalItemDataTables(), encoding: 'gbk' })
}

function hex(text: string): Uint8Array {
  return Uint8Array.from(text.match(/../g)!.map(byte => parseInt(byte, 16)))
}

describe('S2C 0xAA AddUnitState (D2Client 0x6fb5db90)', () => {
  it('decodes the captured packets: one state with or without its stat list', () => {
    expect(decode(hex('aa00010000000c6959f9ff1f'))).toEqual({
      type: 'StateSet',
      unit: { unitType: 0, id: 1 },
      state: 105,
      stats: [{ statId: 172, param: 0, value: 2 }],
      origin: 0xaa,
      states: [{ state: 105, stats: [{ statId: 172, param: 0, value: 2 }], complete: true }],
    })
    expect(decode(hex('aa01130000000a69fe01'))).toEqual({
      type: 'StateSet',
      unit: { unitType: 1, id: 19 },
      state: 105,
      origin: 0xaa,
      states: [{ state: 105, complete: true }],
    })
    const monster20 = decode(hex('aa01140000000c6959f5ff1f'))
    expect(monster20.type === 'StateSet' && monster20.states).toEqual([
      { state: 105, stats: [{ statId: 172, param: 0, value: 1 }], complete: true },
    ])
  })

  it('lists every state of the bitstream in order', () => {
    const ev = decode(
      packet0xAA(1, 7, [
        { state: CLOAK_OF_SHADOWS, stats: [[MODIFIERLIST_SKILL, 264], [MODIFIERLIST_LEVEL, 12]] },
        { state: 105 },
        { state: 11, stats: [[172, 3]] },
      ]),
    )
    expect(ev).toEqual({
      type: 'StateSet',
      unit: { unitType: 1, id: 7 },
      state: CLOAK_OF_SHADOWS,
      stats: [
        { statId: MODIFIERLIST_SKILL, param: 0, value: 264 },
        { statId: MODIFIERLIST_LEVEL, param: 0, value: 12 },
      ],
      origin: 0xaa,
      states: [
        {
          state: CLOAK_OF_SHADOWS,
          stats: [
            { statId: MODIFIERLIST_SKILL, param: 0, value: 264 },
            { statId: MODIFIERLIST_LEVEL, param: 0, value: 12 },
          ],
          complete: true,
        },
        { state: 105, complete: true },
        { state: 11, stats: [{ statId: 172, param: 0, value: 3 }], complete: true },
      ],
    })
  })

  it('ends the packet at a stat bail-out: that state is incomplete, later states are not read', () => {
    for (const badStat of [STAT_SEND_BITS_0, STAT_UNKNOWN]) {
      const ev = decode(
        packet0xAA(1, 7, [
          { state: 105 },
          { state: CLOAK_OF_SHADOWS, stats: [[MODIFIERLIST_SKILL, 264], [badStat, 0]] },
          { state: 11 },
        ]),
      )
      expect(ev.type === 'StateSet' && ev.states, `stat ${badStat}`).toEqual([
        { state: 105, complete: true },
        { state: CLOAK_OF_SHADOWS, stats: [{ statId: MODIFIERLIST_SKILL, param: 0, value: 264 }], complete: false },
      ])
    }
  })

  it('marks a stat list that runs out of bits without the 0x1ff terminator as incomplete', () => {
    const ev = decode(
      packet0xAA(1, 7, [{ state: CLOAK_OF_SHADOWS, stats: [[MODIFIERLIST_SKILL, 264]], terminate: false }], false),
    )
    expect(ev.type === 'StateSet' && ev.states).toEqual([
      { state: CLOAK_OF_SHADOWS, stats: [{ statId: MODIFIERLIST_SKILL, param: 0, value: 264 }], complete: false },
    ])
  })

  it('ClientWorld sets every listed state on the unit', () => {
    const world = new ClientWorld()
    world.apply(
      decode(packet0xAA(1, 7, [{ state: CLOAK_OF_SHADOWS, stats: [[MODIFIERLIST_SKILL, 264]] }, { state: 105 }])),
    )
    const unit = world.getUnit(1, 7)
    expect(unit?.states.has(CLOAK_OF_SHADOWS)).toBe(true)
    expect(unit?.states.has(105)).toBe(true)
  })
})

describe('S2C 0xA8 SetState (D2Client 0x6fb5dd70)', () => {
  it('decodes the captured packet; the 0x1ff terminator makes it complete', () => {
    expect(decode(hex('a800010000000b69acfc0f'))).toEqual({
      type: 'StateSet',
      unit: { unitType: 0, id: 1 },
      state: 105,
      stats: [{ statId: 172, param: 0, value: 2 }],
      origin: 0xa8,
      complete: true,
    })
  })

  it('is incomplete after a bail-out or without the terminator (no set-function dispatch)', () => {
    for (const pkt of [
      packet0xA8(0, 1, CLOAK_OF_SHADOWS, [[MODIFIERLIST_SKILL, 264], [STAT_UNKNOWN, 0]]),
      packet0xA8(0, 1, CLOAK_OF_SHADOWS, [[STAT_SEND_BITS_0, 0]]),
      packet0xA8(0, 1, CLOAK_OF_SHADOWS, [[MODIFIERLIST_SKILL, 264]], false),
    ]) {
      const ev = decode(pkt)
      expect(ev.type === 'StateSet' && ev.origin).toBe(0xa8)
      expect(ev.type === 'StateSet' && ev.complete).toBe(false)
    }
  })
})

describe('S2C 0xA5 StateSkillEffect & 0xA7 StateSet (no stat list)', () => {
  it('decodes 0xA5 as StateSkillEffect (skillId) and 0xA7 as StateSet (origin 0xA7)', () => {
    expect(decode(packet0xA5(1, 7, CLOAK_OF_SHADOWS))).toEqual({
      type: 'StateSkillEffect',
      unit: { unitType: 1, id: 7 },
      skillId: CLOAK_OF_SHADOWS,
    })
    expect(decode(packet0xA7(1, 7, CLOAK_OF_SHADOWS))).toEqual({
      type: 'StateSet',
      unit: { unitType: 1, id: 7 },
      state: CLOAK_OF_SHADOWS,
      origin: 0xa7,
    })
  })
})
