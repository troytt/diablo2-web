/**
 * Issue #1639: stats with ItemStatCost `ValShift` (maxhp 7, maxmana 9, maxstamina 11, item_hp_perlevel 216,
 * item_mana_perlevel 217 — ValShift 8) were stored unshifted, so the bitstream encoder (`>> ValShift`)
 * truncated them to 0 on every 0x9C/0x9D and .d2s encode.
 *
 * 1.13c ground truth (samples/d2/D2Common.dll, `objdump -d -M intel`):
 *  - ITEMMODS_AddPropertyToItemStatList 0x6fd975e0: `mov cl,[esi+0x18]` (0x6fd97653, ISC ValShift) then
 *    `shl eax,cl` (0x6fd97664) — stat lists hold `value << ValShift`.
 *  - item stat decoder 0x6fd79d90: `(raw - SaveAdd) << ValShift` (0x6fd79e8f..0x6fd79e92).
 *  - item stat encoder: `sar ebx,cl` with cl = ValShift (0x6fd7835b..0x6fd7835e) before writing.
 */
import { describe, expect, it } from 'vitest'
import { getCanonicalItemDataTables } from '../src/client/world/item-tables-provider.ts'
import {
  convertOnlineItemStatsToRolledProps,
  itemStatValShift,
  rolledPropsToItemStats,
} from '../src/common/items/item-bridge.ts'
import { decodeD2gsItemPacket, encodeD2gsItemPacket } from '../src/netproto/d2gs/items/item-bitstream.ts'
import type { ItemData, ItemStat } from '../src/netproto/domain/ids.ts'

const tables = getCanonicalItemDataTables()

function ring(stats: ItemStat[]): ItemData {
  return {
    id: 5, itemId: 5, opcode: 0x9c, action: 0, category: 0, rawFlags: 0x10, flags: 0x10, version: 101,
    location: 3, container: 'ground', worldX: 1, worldY: 1, code: 'rin', rawCode: 'rin ', compact: false,
    identified: true, ilvl: 30, quality: 4, magicPrefixId: 1, magicSuffixId: 1, stats,
    setBonusStats: [], runewordStats: [],
  } as unknown as ItemData
}

describe('issue #1639: ValShift stats are stored shifted (D2Common 0x6fd975e0)', () => {
  it('reads ValShift from ItemStatCost.txt', () => {
    for (const id of [6, 7, 8, 9, 10, 11, 216, 217]) expect(itemStatValShift(id)).toBe(8)
    expect(itemStatValShift(0)).toBe(0)
    expect(() => itemStatValShift(9999)).toThrow()
  })

  it('rolledPropsToItemStats shifts ValShift stats into internal units', () => {
    expect(
      rolledPropsToItemStats([
        { code: 'hp/lvl', param: 12, min: 0, max: 0, value: 0 },
        { code: 'mana/lvl', param: 8, min: 0, max: 0, value: 0 },
        { code: 'str', min: 10, max: 10, value: 10 },
      ] as never),
    ).toEqual([
      { statId: 216, value: 12 << 8 },
      { statId: 217, value: 8 << 8 },
      { statId: 0, value: 10 },
    ])
  })

  it('survives a 0x9C encode/decode and displays the rolled value', () => {
    for (const [statId, display] of [[7, 30], [9, 20], [11, 15], [216, 12], [217, 8]] as const) {
      const stats: ItemStat[] = [{ statId, param: 0, value: display << 8 }]
      const dec = decodeD2gsItemPacket(encodeD2gsItemPacket(ring(stats), tables), tables)
      expect(dec.stats).toEqual(stats)
      const { props } = convertOnlineItemStatsToRolledProps(dec.stats)
      expect(props[0]?.value).toBe(display)
    }
  })
})
