/**
 * Byte-level golden tests for NPC vendor / stash gold packets (1.13c).
 *
 * Layouts are taken from the disassembly (see each encoder/decoder's doc comment):
 * - 0x4F ClickButton: D2Game 0x6fcf1470 amount = (WORD[3] << 16) | WORD[5].
 * - 0x32 / 0x33 / 0x35: D2Client 0x6faf6ee0 / 0x6fb46d5f / 0x6faf7dff, D2Game 0x6fcef220 / 0x6fcef0a0.
 * - 0x38: D2Game 0x6fce00c0 action 1 = trade, 2 = gamble.
 * - 0x2A: D2Game 0x6fcaac90 builder; D2Client 0x6fafbc80 reader.
 */

import { describe, expect, it } from 'vitest'
import { decode0x2ANpcTransaction } from '../../src/netproto/d2gs/s2c/npc.ts'
import { encodeD2gsClientCommand } from '../../src/netproto/d2gs/registry.ts'
import { ClickButtonId } from '../../src/netproto/d2gs/c2s/interact.ts'

const bytes = (cmd: Parameters<typeof encodeD2gsClientCommand>[0]): number[] => {
  const pkts = encodeD2gsClientCommand(cmd)
  expect(pkts).toHaveLength(1)
  return Array.from(pkts[0]!)
}

describe('C2S 0x4F ClickButton (amount high word first)', () => {
  it('deposit 0x00012345 gold -> 4F 14 00 | 01 00 | 45 23', () => {
    expect(bytes({ type: 'ClickButton', buttonId: ClickButtonId.DepositGold, amount: 0x00012345 })).toEqual([
      0x4f, 0x14, 0x00, 0x01, 0x00, 0x45, 0x23,
    ])
  })

  it('withdraw 1 gold -> 4F 13 00 | 00 00 | 01 00', () => {
    expect(bytes({ type: 'ClickButton', buttonId: ClickButtonId.WithdrawGold, amount: 1 })).toEqual([
      0x4f, 0x13, 0x00, 0x00, 0x00, 0x01, 0x00,
    ])
  })

  it('close stash / transmute carry amount 0', () => {
    expect(bytes({ type: 'ClickButton', buttonId: ClickButtonId.CloseStash, amount: 0 })).toEqual([
      0x4f, 0x12, 0x00, 0x00, 0x00, 0x00, 0x00,
    ])
    expect(bytes({ type: 'ClickButton', buttonId: ClickButtonId.Transmute, amount: 0 })).toEqual([
      0x4f, 0x18, 0x00, 0x00, 0x00, 0x00, 0x00,
    ])
  })

  it('trade gold reuses the same hi/lo layout (button 0x08)', () => {
    expect(bytes({ type: 'Trade', action: ClickButtonId.TradeGold, gold: 2_500_000 })).toEqual([
      // 2_500_000 = 0x002625A0
      0x4f, 0x08, 0x00, 0x26, 0x00, 0xa0, 0x25,
    ])
  })

  it('rejects non-integer / out-of-range amounts', () => {
    expect(() => bytes({ type: 'ClickButton', buttonId: 0x14, amount: -1 })).toThrow(RangeError)
    expect(() => bytes({ type: 'ClickButton', buttonId: 0x14, amount: 1.5 })).toThrow(RangeError)
    expect(() => bytes({ type: 'ClickButton', buttonId: 0x10000, amount: 0 })).toThrow(RangeError)
  })
})

describe('C2S 0x38 NpcEntityAction', () => {
  it('trade = action 1, complement 0', () => {
    expect(bytes({ type: 'NpcOpenTrade', npcId: 7 })).toEqual([
      0x38, 0x01, 0, 0, 0, 0x07, 0, 0, 0, 0, 0, 0, 0,
    ])
  })
  it('gamble = action 2, complement 0', () => {
    expect(bytes({ type: 'NpcOpenGamble', npcId: 0x0102 })).toEqual([
      0x38, 0x02, 0, 0, 0, 0x02, 0x01, 0, 0, 0, 0, 0, 0,
    ])
  })
})

describe('C2S 0x32 NpcBuy field3', () => {
  it('plain buy: field3 = itemMode << 16', () => {
    expect(
      bytes({ type: 'NpcBuy', npcId: 7, itemId: 0x20, itemMode: 0, gamble: false, shiftFill: false, cost: 25 }),
    ).toEqual([0x32, 7, 0, 0, 0, 0x20, 0, 0, 0, 0, 0, 0, 0, 25, 0, 0, 0])
    expect(
      bytes({ type: 'NpcBuy', npcId: 7, itemId: 0x20, itemMode: 0x0004, gamble: false, shiftFill: false, cost: 25 }),
    ).toEqual([0x32, 7, 0, 0, 0, 0x20, 0, 0, 0, 0x00, 0x00, 0x04, 0x00, 25, 0, 0, 0])
  })
  it('gamble sets bit 1, shift-fill sets bit 31', () => {
    expect(
      bytes({ type: 'NpcBuy', npcId: 1, itemId: 2, itemMode: 0, gamble: true, shiftFill: false, cost: 0x1234 }),
    ).toEqual([0x32, 1, 0, 0, 0, 2, 0, 0, 0, 0x02, 0, 0, 0, 0x34, 0x12, 0, 0])
    expect(
      bytes({ type: 'NpcBuy', npcId: 1, itemId: 2, itemMode: 0, gamble: false, shiftFill: true, cost: 1 }),
    ).toEqual([0x32, 1, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0x80, 1, 0, 0, 0])
  })
  it('requires a u16 itemMode and u32 cost', () => {
    expect(() =>
      bytes({ type: 'NpcBuy', npcId: 1, itemId: 2, itemMode: 0x10000, gamble: false, shiftFill: false, cost: 1 }),
    ).toThrow(RangeError)
    expect(() =>
      bytes({ type: 'NpcBuy', npcId: 1, itemId: 2, itemMode: 0, gamble: false, shiftFill: false, cost: Number.NaN }),
    ).toThrow(RangeError)
  })
})

describe('C2S 0x33 NpcSell', () => {
  it('field3 = itemMode', () => {
    expect(bytes({ type: 'NpcSell', npcId: 7, itemId: 0x31, itemMode: 0, cost: 12 })).toEqual([
      0x33, 7, 0, 0, 0, 0x31, 0, 0, 0, 0, 0, 0, 0, 12, 0, 0, 0,
    ])
  })
})

describe('C2S 0x35 Repair', () => {
  it('single item: itemId, itemMode, current durability (never the repair-all bit)', () => {
    expect(bytes({ type: 'NpcRepairItem', npcId: 7, itemId: 0x40, itemMode: 1, durability: 13 })).toEqual([
      0x35, 7, 0, 0, 0, 0x40, 0, 0, 0, 1, 0, 0, 0, 13, 0, 0, 0,
    ])
    expect(() =>
      bytes({ type: 'NpcRepairItem', npcId: 7, itemId: 0x40, itemMode: 1, durability: 0x80000000 }),
    ).toThrow(RangeError)
  })
  it('repair all: itemId 0, field3 0, field4 0x80000000', () => {
    expect(bytes({ type: 'NpcRepairAll', npcId: 7 })).toEqual([
      0x35, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x80,
    ])
  })
})

describe('S2C 0x2A NPCTransaction', () => {
  it('decodes flag@1, result@2, itemId@7, gold@11 and ignores the uninitialised bytes 3..6', () => {
    const pkt = new Uint8Array([
      0x2a, 0x01, 0x02, 0xde, 0xad, 0xbe, 0xef, 0xff, 0xff, 0xff, 0xff, 0x39, 0x30, 0x00, 0x00,
    ])
    expect(decode0x2ANpcTransaction(pkt)).toEqual({
      type: 'NpcTransaction',
      result: 2,
      flag: 1,
      itemId: 0xffffffff,
      gold: 12345,
    })
  })
})
