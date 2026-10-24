/**
 * Display prices for real server items (captures 05-09) through the 1.13c #10107/#10071 port.
 */
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { replayD2CapFile } from '../../tools/netproto-replay.ts'
import { getCanonicalItemDataTables } from '../../src/client/world/item-tables-provider.ts'
import { priceItem113c, repairAllCost113c } from '../../src/client/ui-model/transaction-cost-input.ts'
import { decodeD2gsItemPacket, encodeD2gsItemPacket } from '../../src/netproto/index.ts'

const FIXTURES = path.resolve(__dirname, '../fixtures/netproto')
const CHARSI = 154
const GHEED = 147

describe('1.13c prices for captured server items', () => {
  it('prices every Charsi shop item (capture 05) without missing data', () => {
    const { world } = replayD2CapFile(path.join(FIXTURES, '05-d2gs-vendor-open.d2cap'))
    const shop = [...world.containers.shop.values()]
    expect(shop.length).toBe(46)
    for (const it of shop) {
      const p = priceItem113c(world, it, 0, CHARSI)
      expect(Number.isInteger(p)).toBe(true)
      expect(p).toBeGreaterThan(0)
    }
  })

  it('every gamble preview (capture 09) costs more than the 2 gold that made the server reject it (0x2A result 12)', () => {
    const { world } = replayD2CapFile(path.join(FIXTURES, '09-d2gs-gamble.d2cap'))
    const shop = [...world.containers.shop.values()]
    expect(shop.length).toBe(14)
    for (const it of shop) expect(priceItem113c(world, it, 2, GHEED)).toBeGreaterThan(2)
  })

  it('repair-all costs 0 with full durability (capture 07: server answered result 2 flag 1, gold unchanged)', () => {
    const { world } = replayD2CapFile(path.join(FIXTURES, '07-d2gs-vendor-repair.d2cap'))
    expect(world.containers.equipment.size).toBe(2)
    expect(repairAllCost113c(world, CHARSI)).toBe(0)
  })

  it('prices normal body-part items (ITYPE_BODYPART=40, e.g. hrt/eyz) and round-trips 10-bit bodyPartMonsterClass in 0x9C bitstream', () => {
    const { world } = replayD2CapFile(path.join(FIXTURES, '05-d2gs-vendor-open.d2cap'))
    const tables = getCanonicalItemDataTables()
    const sample = [...world.containers.inventory.values()][0] ?? [...world.containers.shop.values()][0]!
    const bodyItem = {
      ...sample,
      id: 9901,
      itemId: 9901,
      code: 'hrt',
      rawCode: 'hrt ',
      compact: false,
      simple: false,
      rawFlags: 0x00000010, // ITEM_FLAG_IDENTIFIED
      flags: 0x00000010,
      quality: 2 as const,
      identified: true,
      bodyPartMonsterClass: 317,
      stats: [],
      setBonusStats: [],
      runewordStats: [],
    }
    const pkt = encodeD2gsItemPacket(bodyItem, tables)
    const decoded = decodeD2gsItemPacket(pkt, tables)
    expect(decoded.bodyPartMonsterClass).toBe(317)

    const cost = priceItem113c(world, decoded, 1, CHARSI)
    expect(Number.isInteger(cost)).toBe(true)
    expect(cost).toBeGreaterThanOrEqual(0)

    // Also works when bodyPartMonsterClass is omitted on ItemData (defaults to 0 per D2ItemDataStrc zero-init)
    const { bodyPartMonsterClass: _, ...bodyItemWithoutClass } = bodyItem
    expect(() => priceItem113c(world, bodyItemWithoutClass, 1, CHARSI)).not.toThrow()
  })

  it('round-trips unidentified rare 6-slot affixes unconditionally and does not throw in requireDefined when priced', () => {
    const { world } = replayD2CapFile(path.join(FIXTURES, '05-d2gs-vendor-open.d2cap'))
    const tables = getCanonicalItemDataTables()
    const sample = [...world.containers.shop.values()][0]!

    // Unidentified rare item on the wire still carries the 6 affix presence/id slots (0x6fd7aa05..0x6fd7aa9f)
    const unidRare = {
      ...sample,
      id: 9905,
      itemId: 9905,
      code: 'rin',
      rawCode: 'rin ',
      compact: false,
      simple: false,
      rawFlags: 0, // unidentified, extended
      flags: 0,
      quality: 6 as const,
      identified: false,
      rareAffixes: [12, 34, 0, 56, 0, 0],
      stats: [],
      setBonusStats: [],
      runewordStats: [],
    }
    const pkt = encodeD2gsItemPacket(unidRare, tables)
    const decoded = decodeD2gsItemPacket(pkt, tables)
    expect(decoded.rareAffixes).toEqual([12, 34, 0, 56, 0, 0])

    for (const quality of [4, 5, 6, 7, 8] as const) {
      const item = {
        ...sample,
        id: 9910 + quality,
        itemId: 9910 + quality,
        code: 'rin',
        rawCode: 'rin ',
        quality,
        identified: true,
        magicPrefixId: undefined,
        magicSuffixId: undefined,
        rareAffixes: undefined,
        setItemId: undefined,
        uniqueItemId: undefined,
        earLevel: undefined,
      }
      expect(() => priceItem113c(world, item, 1, CHARSI)).not.toThrow()
      expect(priceItem113c(world, item, 1, CHARSI)).toBeGreaterThan(0)
    }
  })
})
