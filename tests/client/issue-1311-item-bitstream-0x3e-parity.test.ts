import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { getCanonicalItemDataTables } from '../../src/client/world/item-tables-provider.ts'
import {
  onlineItemDataToUiInventoryItem,
  resolveOnlineItemReqLevel,
} from '../../src/common/items/item-bridge.ts'
import { BitWriter } from '../../src/netproto/core/bit-writer.ts'
import { decode0x3EUpdateItemStats } from '../../src/netproto/d2gs/s2c/stats.ts'
import {
  decodeD2gsItemPacket,
  encodeD2gsItemPacket,
} from '../../src/netproto/d2gs/items/item-bitstream.ts'
import {
  ITEM_FLAG_BROKEN,
  ITEM_FLAG_COMPACT,
  ITEM_FLAG_IDENTIFIED,
  ITEM_FLAG_SIMPLE_EXTENDED,
} from '../../src/netproto/d2gs/items/item-types.ts'
import type { ItemData } from '../../src/netproto/domain/ids.ts'

function build0x3EPacket(
  itemId: number,
  flag: 0 | 1,
  stat: number,
  value: number,
  param: number,
): Uint8Array {
  const w = new BitWriter()
  if (itemId <= 0xff) {
    w.writeBit(0).writeBits(itemId, 8)
  } else if (itemId <= 0xffff) {
    w.writeBit(1).writeBit(0).writeBits(itemId, 16)
  } else {
    w.writeBit(1).writeBit(1).writeBits(itemId >>> 0, 32)
  }
  w.writeBit(flag)
  w.writeBits(stat & 0x1ff, 9)
  if (value >= 0 && value <= 0xff) {
    w.writeBit(0).writeBits(value, 8)
  } else if (value >= 0 && value <= 0xffff) {
    w.writeBit(1).writeBit(0).writeBits(value, 16)
  } else {
    w.writeBit(1).writeBit(1).writeBits(value >>> 0, 32)
  }
  if (param <= 0xff) {
    w.writeBit(0).writeBits(param, 8)
  } else {
    w.writeBit(1).writeBits(param & 0xffff, 16)
  }
  w.alignToByte()
  const body = w.toUint8Array()
  const pkt = new Uint8Array(2 + body.length)
  pkt[0] = 0x3e
  pkt[1] = pkt.length
  pkt.set(body, 2)
  return pkt
}

describe('Issue #1311: 1.13c item bitstream, poison compound stats, 0x3E UpdateItemStats, and socket cleanup', () => {
  const tables = getCanonicalItemDataTables()

  it('0x3E UpdateItemStats preserves high-byte maxCharges on stat 204 (item_charged_skill) and clears broken on stat 70 > 0', () => {
    const world = new ClientWorld()
    const teleportParam = (54 << 6) | 2 // Level 2 Teleport (skill 54)
    const packedCharges = (25 << 8) | 20 // 20 / 25 charges
    const staff: ItemData = {
      id: 301,
      itemId: 301,
      opcode: 0x9c,
      action: 0x04,
      category: 0,
      flags: ITEM_FLAG_IDENTIFIED | ITEM_FLAG_BROKEN,
      rawFlags: ITEM_FLAG_IDENTIFIED | ITEM_FLAG_BROKEN,
      version: 100,
      location: 0,
      container: 'inventory',
      bodyLoc: 0,
      equippedSlot: 0,
      gridX: 0,
      gridY: 0,
      storePage: 1,
      storagePage: 1,
      worldX: 0,
      worldY: 0,
      x: 0,
      y: 0,
      code: 'jav',
      rawCode: 'jav ',
      compact: false,
      simple: false,
      identified: true,
      socketed: false,
      ethereal: false,
      runeword: false,
      personalized: false,
      isEar: false,
      newItem: false,
      starterItem: false,
      broken: true,
      inSocket: false,
      equipped: false,
      socketedChildCount: 0,
      usedSockets: 0,
      totalSockets: 0,
      invWidth: 1,
      invHeight: 3,
      quantity: 0,
      stats: [{ statId: 204, param: teleportParam, value: packedCharges }],
      setBonusStats: [],
      runewordStats: [],
    }
    world.apply({ type: 'ItemEvent', action: 0x04, container: 'inventory', item: staff })

    // 1. Update charged skill (stat 204) current charges to 19
    const evCharges = decode0x3EUpdateItemStats(build0x3EPacket(301, 1, 204, 19, teleportParam))
    expect(evCharges).toEqual({
      type: 'StatSet',
      stat: 204,
      value: 19,
      param: teleportParam,
      flag: 1,
      unit: { unitType: 4, id: 301 },
    })
    world.apply(evCharges)
    const updatedItem = world.containers.inventory.get(301)!
    const stat204 = updatedItem.stats.find((s) => s.statId === 204)!
    expect(stat204.value & 0xff).toBe(19)
    expect((stat204.value >>> 8) & 0xff).toBe(25)

    // 2. Replenish stackable quantity (stat 70) to 40 -> clears broken flag
    const evQty = decode0x3EUpdateItemStats(build0x3EPacket(301, 1, 70, 40, 0))
    world.apply(evQty)
    const replenished = world.containers.inventory.get(301)!
    expect(replenished.quantity).toBe(40)
    expect(replenished.broken).toBe(false)
    expect((replenished.rawFlags & ITEM_FLAG_BROKEN) !== 0).toBe(false)
  })

  it('round-trips compound poison damage stats (57 -> 58, 59) without shifting subsequent stats', () => {
    const baseCharm: ItemData = {
      id: 401,
      itemId: 401,
      opcode: 0x9c,
      action: 0x04,
      category: 0,
      flags: ITEM_FLAG_IDENTIFIED,
      rawFlags: ITEM_FLAG_IDENTIFIED,
      version: 100,
      location: 0,
      container: 'inventory',
      bodyLoc: 0,
      equippedSlot: 0,
      gridX: 1,
      gridY: 1,
      storePage: 1,
      storagePage: 1,
      worldX: 0,
      worldY: 0,
      x: 1,
      y: 1,
      code: 'cm1',
      rawCode: 'cm1 ',
      compact: false,
      simple: false,
      identified: true,
      socketed: false,
      ethereal: false,
      runeword: false,
      personalized: false,
      isEar: false,
      newItem: false,
      starterItem: false,
      broken: false,
      inSocket: false,
      equipped: false,
      socketedChildCount: 0,
      usedSockets: 0,
      totalSockets: 0,
      ilvl: 80,
      quality: 4,
      magicPrefixId: 100,
      magicSuffixId: 200,
      invWidth: 1,
      invHeight: 1,
      stats: [
        { statId: 57, param: 0, value: 102 },
        { statId: 58, param: 0, value: 102 },
        { statId: 59, param: 0, value: 125 },
        { statId: 7, param: 0, value: 20 << 8 }, // maxhp +20
      ],
      setBonusStats: [],
      runewordStats: [],
    }
    const pkt = encodeD2gsItemPacket(baseCharm, tables)
    const decoded = decodeD2gsItemPacket(pkt, tables)
    expect(decoded.stats).toEqual([
      { statId: 57, param: 0, value: 102 },
      { statId: 58, param: 0, value: 102 },
      { statId: 59, param: 0, value: 125 },
      { statId: 7, param: 0, value: 20 << 8 },
    ])
  })

  it('decodes compact scroll magicSuffixId, compact quest item difficulty (stat 356), and gamble mystery flag (0x02000000)', () => {
    const compactTsc: ItemData = {
      id: 501,
      itemId: 501,
      opcode: 0x9c,
      action: 0x04,
      category: 0,
      flags: ITEM_FLAG_COMPACT | ITEM_FLAG_IDENTIFIED,
      rawFlags: ITEM_FLAG_COMPACT | ITEM_FLAG_IDENTIFIED,
      version: 100,
      location: 0,
      container: 'inventory',
      bodyLoc: 0,
      equippedSlot: 0,
      gridX: 0,
      gridY: 0,
      storePage: 1,
      storagePage: 1,
      worldX: 0,
      worldY: 0,
      x: 0,
      y: 0,
      code: 'tsc',
      rawCode: 'tsc ',
      compact: true,
      simple: true,
      identified: true,
      socketed: false,
      ethereal: false,
      runeword: false,
      personalized: false,
      isEar: false,
      newItem: false,
      starterItem: false,
      broken: false,
      inSocket: false,
      equipped: false,
      socketedChildCount: 0,
      usedSockets: 0,
      totalSockets: 0,
      invWidth: 1,
      invHeight: 1,
      stats: [],
      setBonusStats: [],
      runewordStats: [],
    }
    const decodedTsc = decodeD2gsItemPacket(encodeD2gsItemPacket(compactTsc, tables), tables)
    expect(decodedTsc.magicSuffixId).toBe(0)
    const uiTsc = onlineItemDataToUiInventoryItem(decodedTsc, undefined, undefined, 1)
    expect(uiTsc.quality).toBe('normal')
    expect(uiTsc.name).toBe('Scroll of Town Portal')
    expect(uiTsc.nameZh).toBe('城镇传送卷轴')
    expect(uiTsc.reqLevel).toBeUndefined()
    expect(resolveOnlineItemReqLevel(decodedTsc)).toBe(0)

    const compactIsc: ItemData = { ...compactTsc, id: 502, itemId: 502, code: 'isc', rawCode: 'isc ' }
    const decodedIsc = decodeD2gsItemPacket(encodeD2gsItemPacket(compactIsc, tables), tables)
    expect(decodedIsc.magicSuffixId).toBe(1)
    const uiIsc = onlineItemDataToUiInventoryItem(decodedIsc, undefined, undefined, 1)
    expect(uiIsc.quality).toBe('normal')
    expect(uiIsc.name).toBe('Scroll of Identify')
    expect(uiIsc.nameZh).toBe('辨视卷轴')
    expect(uiIsc.reqLevel).toBeUndefined()
    expect(resolveOnlineItemReqLevel(decodedIsc)).toBe(0)

    const compactMss: ItemData = {
      ...compactTsc,
      id: 503,
      itemId: 503,
      code: 'mss',
      rawCode: 'mss ',
      stats: [{ statId: 356, param: 0, value: 2 }],
    }
    const decodedMss = decodeD2gsItemPacket(encodeD2gsItemPacket(compactMss, tables), tables)
    expect(decodedMss.stats).toEqual([{ statId: 356, param: 0, value: 2 }])

    const gambleMystery: ItemData = {
      ...compactTsc,
      id: 504,
      itemId: 504,
      code: 'rin',
      rawCode: 'rin ',
      compact: false,
      simple: false,
      identified: false,
      flags: ITEM_FLAG_SIMPLE_EXTENDED,
      rawFlags: ITEM_FLAG_SIMPLE_EXTENDED,
    }
    const decodedGamble = decodeD2gsItemPacket(encodeD2gsItemPacket(gambleMystery, tables), tables)
    expect(decodedGamble.isGambleMystery).toBe(true)
  })

  it('cleans up socketed child items from sockets and allById when parent item is permanently deleted', () => {
    const world = new ClientWorld()
    const parentArmor: ItemData = {
      id: 600,
      itemId: 600,
      opcode: 0x9c,
      action: 0x04,
      category: 0,
      flags: ITEM_FLAG_IDENTIFIED,
      rawFlags: ITEM_FLAG_IDENTIFIED,
      version: 100,
      location: 0,
      container: 'inventory',
      bodyLoc: 0,
      equippedSlot: 0,
      gridX: 0,
      gridY: 0,
      storePage: 1,
      storagePage: 1,
      worldX: 0,
      worldY: 0,
      x: 0,
      y: 0,
      code: 'qui',
      rawCode: 'qui ',
      compact: false,
      simple: false,
      identified: true,
      socketed: true,
      ethereal: false,
      runeword: false,
      personalized: false,
      isEar: false,
      newItem: false,
      starterItem: false,
      broken: false,
      inSocket: false,
      equipped: false,
      socketedChildCount: 1,
      usedSockets: 1,
      totalSockets: 2,
      invWidth: 2,
      invHeight: 3,
      stats: [],
      setBonusStats: [],
      runewordStats: [],
    }
    const childGem: ItemData = {
      ...parentArmor,
      id: 601,
      itemId: 601,
      opcode: 0x9d,
      action: 0x0a,
      ownerType: 4,
      ownerId: 600,
      location: 6,
      container: 'socket',
      code: 'gcv',
      rawCode: 'gcv ',
      compact: true,
      simple: true,
      socketed: false,
      inSocket: true,
      socketedChildCount: 0,
      usedSockets: 0,
      totalSockets: 0,
      invWidth: 1,
      invHeight: 1,
    }
    world.apply({ type: 'ItemEvent', action: 0x04, container: 'inventory', item: parentArmor })
    world.apply({ type: 'ItemEvent', action: 0x0a, container: 'socket', item: childGem })
    expect(world.containers.sockets.get(600)).toHaveLength(1)
    expect(world.containers.allById.has(601)).toBe(true)

    // Permanently delete parent via action 0x05 with IFLAG_DELETED (0x20)
    world.apply({
      type: 'ItemEvent',
      action: 0x05,
      container: 'inventory',
      item: { ...parentArmor, flags: 0x20, rawFlags: 0x20 },
    })
    expect(world.containers.sockets.has(600)).toBe(false)
    expect(world.containers.allById.has(600)).toBe(false)
    expect(world.containers.allById.has(601)).toBe(false)
  })
})
