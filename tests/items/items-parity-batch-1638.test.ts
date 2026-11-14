import { describe, expect, it } from 'vitest'
import { getCanonicalItemDataTables } from '../../src/client/world/item-tables-provider.ts'
import { createDroppedItem } from '../../src/common/items/drop-tables.ts'
import { getEmbeddedDropTables } from '../../src/common/items/embedded-drop-tables.ts'
import {
  convertOnlineItemStatsToRolledProps,
  resolveOnlineItemReqLevel,
  rolledPropsToItemStats,
} from '../../src/common/items/item-bridge.ts'
import { resolveProperty } from '../../src/common/items/properties.ts'
import {
  decodeD2gsItemPacket,
  encodeD2gsItemPacket,
} from '../../src/netproto/d2gs/items/item-bitstream.ts'
import type { ItemData, ItemStat } from '../../src/netproto/domain/ids.ts'
import { domainItemToItemData113c } from '../../src/server/items/server-item-data.ts'

const tables = getCanonicalItemDataTables()
const dropTables = getEmbeddedDropTables()

function makeRing(stats: readonly unknown[]): ItemData {
  return {
    id: 5,
    itemId: 5,
    opcode: 0x9c,
    action: 0,
    category: 0,
    rawFlags: 0x10,
    flags: 0x10,
    version: 101,
    location: 3,
    container: 'ground',
    worldX: 1,
    worldY: 1,
    code: 'rin',
    rawCode: 'rin ',
    compact: false,
    identified: true,
    ilvl: 30,
    quality: 4,
    magicPrefixId: 1,
    magicSuffixId: 1,
    stats,
    setBonusStats: [],
    runewordStats: [],
  } as unknown as ItemData
}

describe('1.13c Items Parity (#1638, #1640, #1641, #1642, #1643, #1646, #1647, #1648, #1651, #1652)', () => {
  it('#1638: hp/mana/stam map to max pools 7/9/11 (ValShift=8) and survive 0x9C round-trip', () => {
    const stats = rolledPropsToItemStats([
      { code: 'hp', min: 30, max: 30, value: 30 },
      { code: 'mana', min: 20, max: 20, value: 20 },
      { code: 'stam', min: 15, max: 15, value: 15 },
    ])
    expect(stats).toEqual([
      { statId: 7, value: 30 << 8 },
      { statId: 9, value: 20 << 8 },
      { statId: 11, value: 15 << 8 },
    ])
    const dec = decodeD2gsItemPacket(encodeD2gsItemPacket(makeRing(stats), tables), tables)
    expect(dec.stats).toEqual([
      { statId: 7, param: 0, value: 30 << 8 },
      { statId: 9, param: 0, value: 20 << 8 },
      { statId: 11, param: 0, value: 15 << 8 },
    ])
    const { props } = convertOnlineItemStatsToRolledProps(dec.stats)
    expect(props.map((p) => [p.code, p.value])).toEqual([
      ['hp', 30],
      ['mana', 20],
      ['stam', 15],
    ])
  })

  it('#1640: dmg% emits 17+18 and writeStatList encodes lone leaders or [18, 17] order without desync', () => {
    const edStats = rolledPropsToItemStats([
      { code: 'dmg%', min: 50, max: 50, value: 50 },
      { code: 'str', min: 10, max: 10, value: 10 },
    ])
    expect(edStats).toEqual([
      { statId: 17, value: 50 },
      { statId: 18, value: 50 },
      { statId: 0, value: 10 },
    ])
    const decEd = decodeD2gsItemPacket(encodeD2gsItemPacket(makeRing(edStats), tables), tables)
    expect(decEd.stats).toEqual([
      { statId: 17, param: 0, value: 50 },
      { statId: 18, param: 0, value: 50 },
      { statId: 0, param: 0, value: 10 },
    ])

    // Lone leader 48 (fire-min) must write 49=0 so subsequent stats do not desync
    const loneFireMin: ItemStat[] = [
      { statId: 48, param: 0, value: 5 },
      { statId: 0, param: 0, value: 12 },
    ]
    const decLone = decodeD2gsItemPacket(encodeD2gsItemPacket(makeRing(loneFireMin), tables), tables)
    expect(decLone.stats).toEqual([
      { statId: 48, param: 0, value: 5 },
      { statId: 49, param: 0, value: 0 },
      { statId: 0, param: 0, value: 12 },
    ])

    // Reverse [18, 17] order must not duplicate 18
    const rev18_17: ItemStat[] = [
      { statId: 18, param: 0, value: 45 },
      { statId: 17, param: 0, value: 45 },
    ]
    const decRev = decodeD2gsItemPacket(encodeD2gsItemPacket(makeRing(rev18_17), tables), tables)
    expect(decRev.stats).toEqual([
      { statId: 17, param: 0, value: 45 },
      { statId: 18, param: 0, value: 45 },
    ])
  })

  it('#1641 & #1642: rolledPropsToItemStats and resolveProperty cover all-stats, res-all-max, dur, levelreq, skill-rand, randclassskill, dmg-elem, dmg-throw, */time, and func 5/6 spread', () => {
    expect(rolledPropsToItemStats([{ code: 'all-stats', min: 5, max: 5, value: 5 }])).toEqual([
      { statId: 0, value: 5 },
      { statId: 1, value: 5 },
      { statId: 2, value: 5 },
      { statId: 3, value: 5 },
    ])
    expect(rolledPropsToItemStats([{ code: 'res-all-max', min: 5, max: 5, value: 5 }])).toEqual([
      { statId: 40, value: 5 },
      { statId: 42, value: 5 },
      { statId: 44, value: 5 },
      { statId: 46, value: 5 },
    ])
    expect(rolledPropsToItemStats([{ code: 'dur', min: 20, max: 20, value: 20 }])).toEqual([
      { statId: 73, value: 20 },
    ])
    expect(rolledPropsToItemStats([{ code: 'levelreq', min: 5, max: 5, value: 5 }])).toEqual([
      { statId: 92, value: 5 },
    ])
    expect(rolledPropsToItemStats([{ code: 'skill-rand', param: 3, min: 47, max: 47, value: 47 }])).toEqual([
      { statId: 107, param: 47, value: 3 },
    ])
    expect(rolledPropsToItemStats([{ code: 'randclassskill', param: 2, min: 3, max: 3, value: 3 }])).toEqual([
      { statId: 83, param: 2, value: 3 },
    ])
    // Non-weapon dmg-min/dmg-max emits 21/23/159 and 22/24/160 (0x6fd987c0 / 0x6fd98630)
    expect(rolledPropsToItemStats([{ code: 'dmg-min', min: 4, max: 4, value: 4 }])).toEqual([
      { statId: 21, value: 4 },
      { statId: 23, value: 4 },
      { statId: 159, value: 4 },
    ])
    // 1H non-throwing weapon ('ssd') emits only 21 for dmg-min
    expect(
      rolledPropsToItemStats([{ code: 'dmg-min', min: 4, max: 4, value: 4 }], { baseCode: 'ssd' }),
    ).toEqual([{ statId: 21, value: 4 }])
    // Throwing weapon ('jav') emits 21 and 159 for dmg-min
    expect(
      rolledPropsToItemStats([{ code: 'dmg-min', min: 4, max: 4, value: 4 }], { baseCode: 'jav' }),
    ).toEqual([
      { statId: 21, value: 4 },
      { statId: 159, value: 4 },
    ])
    expect(
      resolveProperty('dmg%', undefined, 30, 30, {
        properties: dropTables.properties,
        stats: dropTables.itemStatCost,
      }).map((r) => r.statId),
    ).toEqual([17, 18])
  })

  it('#1643: writeStatList saturates negative/overflowing values and skips 0-bit and 0-valued stats', () => {
    const raw: ItemStat[] = [
      { statId: 31, param: 0, value: -20 }, // ac SaveAdd=10 -> saturates to -10
      { statId: 6, param: 0, value: 30 << 8 }, // hitpoints SaveBits=0 -> skipped
      { statId: 0, param: 0, value: 0 }, // 0 value -> skipped
    ]
    const dec = decodeD2gsItemPacket(encodeD2gsItemPacket(makeRing(raw), tables), tables)
    expect(dec.stats).toEqual([{ statId: 31, param: 0, value: -10 }])
  })

  it('#1646 & #1648: crafted reqLevel computes min(98, maxAffixReq + 10 + 3*n) before max(baseReq) and excludes automagic; classlevelreq checks only playerClass === affClass', () => {
    // Base 'uvg' (Vampirebone Gloves, levelreq = 47) with 4 affixes of low levelreq:
    // craft = min(98, maxAffixReq + 10 + 3*4), then max(47, craft)
    const craftedGloves: ItemData = {
      ...makeRing([]),
      code: 'uvg',
      rawCode: 'uvg ',
      quality: 8,
      rareAffixes: [1, 1, 2, 2, 0, 0],
      autoAffixId: 50, // high-level automagic must be ignored on crafted items (0x6fd7637f)
    }
    const req = resolveOnlineItemReqLevel(craftedGloves)
    // Affixes 1 and 2 have levelreq <= 5, so craft = maxAffix + 22 <= 27, and max(47, <=27) = 47 (not 47 + 22 = 69)
    expect(req).toBe(47)
  })

  it('#1647, #1651 & #1652: drop-tables clamps sock by getMaxSockets113c & invWidth*invHeight and populates SetBonusStatList on set items', () => {
    const wardDef = dropTables.sets.items.getById(0)! // Civerb's Ward ('lrg')
    const baseLrg = dropTables.getBase('lrg')!
    const droppedSet = createDroppedItem(baseLrg, 'set', {
      setItem: wardDef,
      ilvl: 20,
      dwInitSeed: 12345,
      identified: true,
    })
    const wire = domainItemToItemData113c(
      { ...droppedSet, defense: 30 },
      dropTables,
      { unitId: 99, compactSave: false },
    )
    expect(wire.setBonusStats.length).toBeGreaterThan(0)
    const dec = decodeD2gsItemPacket(encodeD2gsItemPacket(wire, tables), tables)
    expect(dec.setBonusStats).toEqual(wire.setBonusStats)
  })
})
