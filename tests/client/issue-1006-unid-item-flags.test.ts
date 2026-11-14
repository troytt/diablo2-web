/**
 * Issue #1006: unidentified items rendered as identified (English base name "PlateBoots", no
 * "未辨识", Required Level shown).
 *
 * Root cause: every item-unit `StatSet` treated `value & 0x10` as IFLAG_IDENTIFIED, so a 0x3E
 * UpdateItemStats durability of 16..31 (or a 0x47/0x48 relator) promoted an unidentified item to
 * identified without any of the id data (rare name / unique id / stat lists) the wire omits for it.
 * A gamble window also forged IFLAG_IDENTIFIED for every unidentified item entering the inventory.
 *
 * Ground truth:
 * - D2Client.dll 0x6fb5e300 (0x3E): value is a stat value.
 * - D2Client.dll 0x6fb5e1f0 -> 0x6fb34df0 (0x7D): flag 0x100 -> SetItemFlag(BROKEN, enabled),
 *   flag 0x200 -> SetItemFlag(BROKEN, 0), anything else ignored. Never touches IFLAG_IDENTIFIED.
 * - D2Client.dll 0x6fb5e2b0 / 0x6fb5e260 (0x47 / 0x48): unit lookup + refresh only.
 * - D2Client.dll 0x6fb3357b..0x6fb335a6: unidentified purchased item -> 0x37 IdentifyFromGamble;
 *   D2Game 0x6FCCA990 identifies `dwBoughtItemId` and re-sends the item.
 */
import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { onlineItemDataToUiInventoryItem } from '../../src/common/items/item-bridge.ts'
import { BitWriter } from '../../src/netproto/core/bit-writer.ts'
import {
  decode0x47Relator1,
  decode0x48Relator2,
  decode0x7DSetItemState,
} from '../../src/netproto/d2gs/s2c/items.ts'
import { decode0x3EUpdateItemStats } from '../../src/netproto/d2gs/s2c/stats.ts'
import type { ItemData } from '../../src/netproto/index.ts'

const ITEM_ID = 77
const GAMBLER_ID = 4

/** Unidentified rare Plate Boots (`hbt`) as decoded from the wire: no rare names, no stat lists. */
function makeUnidRareBoots(id = ITEM_ID): ItemData {
  return {
    id,
    itemId: id,
    opcode: 0x9d,
    action: 0x04,
    category: 0,
    flags: 0x00000000,
    rawFlags: 0x00000000,
    version: 101,
    location: 0,
    container: 'inventory',
    bodyLoc: 0,
    equippedSlot: 0,
    gridX: 0,
    gridY: 0,
    storePage: 0,
    storagePage: 0,
    worldX: 0,
    worldY: 0,
    x: 0,
    y: 0,
    code: 'hbt',
    rawCode: 'hbt ',
    compact: false,
    simple: false,
    identified: false,
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
    quality: 6,
    invWidth: 2,
    invHeight: 2,
    defense: 16,
    curDurability: 24,
    maxDurability: 24,
    rareAffixes: [100, 0, 30, 0, 0, 0],
    stats: [],
    setBonusStats: [],
    runewordStats: [],
  } as unknown as ItemData
}

/** S2C 0x3E UpdateItemStats with an 8-bit item id and 8-bit value (D2Client.dll 0x6fb5e300). */
function encode0x3E(itemId: number, stat: number, value: number): Uint8Array {
  const w = new BitWriter()
  w.writeBit(0).writeBits(itemId, 8) // 8-bit id
  w.writeBit(0) // flag
  w.writeBits(stat, 9)
  w.writeBit(0).writeBits(value, 8) // 8-bit value
  w.writeBit(0).writeBits(0, 8) // 8-bit param
  w.alignToByte()
  const body = w.toUint8Array()
  const pkt = new Uint8Array(2 + body.length)
  pkt[0] = 0x3e
  pkt[1] = pkt.length
  pkt.set(body, 2)
  return pkt
}

function encode0x7D(itemId: number, flag: number, enabled: number): Uint8Array {
  const pkt = new Uint8Array(18)
  const dv = new DataView(pkt.buffer)
  pkt[0] = 0x7d
  pkt[1] = 0 // owner: player
  dv.setUint32(2, 1, true)
  dv.setUint32(6, itemId, true)
  dv.setUint32(10, flag, true)
  dv.setUint32(14, enabled, true)
  return pkt
}

function encodeRelator(op: 0x47 | 0x48, itemId: number, value: number): Uint8Array {
  const pkt = new Uint8Array(11)
  const dv = new DataView(pkt.buffer)
  pkt[0] = op
  dv.setUint16(1, 4, true)
  dv.setUint32(3, itemId, true)
  dv.setUint32(7, value, true)
  return pkt
}

function worldWithBoots(): ClientWorld {
  const world = new ClientWorld()
  world.apply({ type: 'ItemEvent', action: 0x04, container: 'inventory', item: makeUnidRareBoots() } as never)
  expect(world.containers.inventory.get(ITEM_ID)?.identified).toBe(false)
  return world
}

function expectStillUnidentified(world: ClientWorld, id = ITEM_ID): void {
  const item = world.containers.inventory.get(id)!
  expect(item.identified).toBe(false)
  expect((item.rawFlags ?? 0) & 0x10).toBe(0)
  const ui = onlineItemDataToUiInventoryItem(item)
  expect(ui.identified).toBe(false)
  expect(ui.nameZh).toBe('护胫')
  expect(ui.reqLevel).toBeUndefined()
  expect(ui.stats.some((s) => s.text === '未辨识')).toBe(true)
}

describe('Issue #1006: unidentified items must not be promoted to identified client-side', () => {
  it('0x3E UpdateItemStats durability=16 (bit 0x10 set) only updates durability', () => {
    const world = worldWithBoots()
    const ev = decode0x3EUpdateItemStats(encode0x3E(ITEM_ID, 72, 16))
    expect(ev).toMatchObject({ type: 'StatSet', stat: 72, value: 16, unit: { unitType: 4, id: ITEM_ID } })
    world.apply(ev)
    expect(world.containers.inventory.get(ITEM_ID)!.curDurability).toBe(16)
    expectStillUnidentified(world)
  })

  it('every durability value in 16..31 keeps the item unidentified', () => {
    const world = worldWithBoots()
    for (let v = 16; v <= 31; v++) world.apply(decode0x3EUpdateItemStats(encode0x3E(ITEM_ID, 72, v)))
    expectStillUnidentified(world)
  })

  it('decodes 0x7D SetItemState per D2Game 0x6FC3EFC0 into ItemFlagUpdate', () => {
    expect(decode0x7DSetItemState(encode0x7D(ITEM_ID, 0x100, 1))).toEqual({
      type: 'ItemFlagUpdate',
      ownerType: 0,
      ownerId: 1,
      itemId: ITEM_ID,
      flag: 0x100,
      enabled: 1,
    })
  })

  it('0x7D only toggles IFLAG_BROKEN (0x100 set / 0x200 clear) and ignores any other flag', () => {
    const world = worldWithBoots()
    world.apply(decode0x7DSetItemState(encode0x7D(ITEM_ID, 0x10, 1)))
    expectStillUnidentified(world)
    expect(world.containers.inventory.get(ITEM_ID)!.stats).toEqual([])

    world.apply(decode0x7DSetItemState(encode0x7D(ITEM_ID, 0x100, 1)))
    let item = world.containers.inventory.get(ITEM_ID)!
    expect(item.broken).toBe(true)
    expect((item.rawFlags ?? 0) & 0x100).toBe(0x100)
    expect(item.stats).toEqual([])
    expectStillUnidentified(world)

    world.apply(decode0x7DSetItemState(encode0x7D(ITEM_ID, 0x200, 1)))
    item = world.containers.inventory.get(ITEM_ID)!
    expect(item.broken).toBe(false)
    expect((item.rawFlags ?? 0) & 0x100).toBe(0)
  })

  it('0x47 / 0x48 relators are refresh-only: no stat or flag mutation', () => {
    const world = worldWithBoots()
    for (const op of [0x47, 0x48] as const) {
      const decode = op === 0x47 ? decode0x47Relator1 : decode0x48Relator2
      const ev = decode(encodeRelator(op, ITEM_ID, 0x1f))
      expect(ev).toEqual({ type: 'ItemRelate', opcode: op, param: 4, itemId: ITEM_ID, value: 0x1f })
      world.apply(ev)
    }
    expect(world.containers.inventory.get(ITEM_ID)!.stats).toEqual([])
    expectStillUnidentified(world)
  })

  it('gamble window: moving an existing unidentified item into the inventory does not identify it or send 0x37', () => {
    const world = new ClientWorld()
    world.noteOutgoingCommand({ type: 'NpcOpenGamble', npcId: GAMBLER_ID })
    world.apply({ type: 'ItemEvent', action: 0x04, container: 'inventory', item: makeUnidRareBoots() } as never)
    expectStillUnidentified(world)
    expect(world.consumePendingGambleIdentifyItems()).toEqual([])
  })

  it('gamble window: the purchased unidentified item requests 0x37 but stays unidentified until the server re-sends it', () => {
    const world = new ClientWorld()
    world.noteOutgoingCommand({ type: 'NpcOpenGamble', npcId: GAMBLER_ID })
    world.noteOutgoingCommand({
      type: 'NpcBuy',
      npcId: GAMBLER_ID,
      itemId: 500,
      itemMode: 0,
      gamble: true,
      shiftFill: false,
      cost: 0,
    })
    world.apply({ type: 'ItemEvent', action: 0x04, container: 'inventory', item: makeUnidRareBoots(901) } as never)
    expect(world.consumePendingGambleIdentifyItems()).toEqual([901])
    expectStillUnidentified(world, 901)

    // Only one purchase was outstanding: a later unidentified item is not treated as gambled.
    world.apply({ type: 'ItemEvent', action: 0x04, container: 'inventory', item: makeUnidRareBoots(902) } as never)
    expect(world.consumePendingGambleIdentifyItems()).toEqual([])
  })

  it('gamble window: a rejected gamble buy (0x2A result 12) does not leave a pending purchase behind', () => {
    const world = new ClientWorld()
    world.noteOutgoingCommand({ type: 'NpcOpenGamble', npcId: GAMBLER_ID })
    world.noteOutgoingCommand({
      type: 'NpcBuy',
      npcId: GAMBLER_ID,
      itemId: 500,
      itemMode: 0,
      gamble: true,
      shiftFill: false,
      cost: 0,
    })
    world.apply({ type: 'NpcTransaction', result: 12, flag: 0, itemId: 500, gold: 0 } as never)
    world.apply({ type: 'ItemEvent', action: 0x04, container: 'inventory', item: makeUnidRareBoots(903) } as never)
    expect(world.consumePendingGambleIdentifyItems()).toEqual([])
    expectStillUnidentified(world, 903)
  })
})
