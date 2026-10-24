/**
 * D2GS S->C Item Packet Decoders (0x9C World Item & 0x9D Owned Item, plus 0x3F/0x42/0x47/0x48/0x7C/0x7D).
 * Verified against D2Client.dll 0x6fb5e080 (0x9C), 0x6fb5e870 (0x9D), and D2Common.11145 (0x6fd7c470).
 */

import { ByteReader } from '../../core/byte-reader.ts'
import type { ItemDataTables } from '../../domain/ids.ts'
import type { ServerEvent } from '../../domain/server-event.ts'
import { decodeD2gsItemPacket } from '../items/item-bitstream.ts'
import { resolveItemContainer } from '../items/item-types.ts'

/** 0x9C ItemActionWorld & 0x9D ItemActionOwned */
export function decode0x9C0x9DItemAction(pkt: Uint8Array, tables: ItemDataTables): ServerEvent {
  const item = decodeD2gsItemPacket(pkt, tables)
  const container = resolveItemContainer(item.opcode, item.action, item.ownerType, item.location, item.storePage)
  const at =
    item.location === 3 || item.location === 5
      ? { x: item.x, y: item.y }
      : undefined
  return {
    type: 'ItemEvent',
    action: item.action,
    item,
    itemId: item.itemId,
    container,
    at,
  }
}

/** 0x3F UseStackableItem (8B, D2Client.dll 0x6fb5f910) */
export function decode0x3FUseStackableItem(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x3F
  const cursorAction = r.u8()
  const itemId = r.u32LE()
  const skillId = r.u16LE()
  return {
    type: 'ActiveSkill',
    unitId: cursorAction,
    hand: 'right',
    skill: skillId,
    itemId,
    isUseStackableItem: true,
  } as ServerEvent
}

/** 0x42 ClearCursor (6B, D2Client.dll 0x6fb5db70 -> 0x6fb32f50) */
export function decode0x42ClearCursor(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x42
  const unitType = (r.u8() & 0x07) as 0 | 1 | 2 | 3 | 4 | 5
  const id = r.u32LE()
  return {
    type: 'CursorClear',
    unitType,
    id,
  }
}

/**
 * 0x47 Relator1 (11B, D2Client.dll 0x6fb5e2b0). The client only looks up the unit and refreshes it
 * (0x6fb32fe0); the payload is not an item stat, so it must not be surfaced as `StatSet` (#1006).
 */
export function decode0x47Relator1(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x47
  const param = r.u16LE()
  const itemId = r.u32LE()
  const value = r.u32LE()
  return { type: 'ItemRelate', opcode: 0x47, param, itemId, value }
}

/** 0x48 Relator2 (11B, D2Client.dll 0x6fb5e260). Same handling as 0x47 (#1006). */
export function decode0x48Relator2(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x48
  const param = r.u16LE()
  const itemId = r.u32LE()
  const value = r.u32LE()
  return { type: 'ItemRelate', opcode: 0x48, param, itemId, value }
}

/**
 * 0x7C UseSpecialItem (6B, D2Client.dll 0x6fb5d2a0 -> 0x6fb31aa0):
 * Wire layout from D2Game.dll 0x6fcac3b0: `[0x7C, u8 unitType (4 = UNIT_ITEM), u32 itemId]`.
 */
export function decode0x7CUseSpecialItem(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x7C
  const unitType = (r.u8() & 0x07) as 0 | 1 | 2 | 3 | 4 | 5
  const id = r.u32LE()
  return {
    type: 'UseSpecialItem',
    unitType,
    id,
  }
}

/**
 * 0x7D SetItemState (18B, D2Client.dll 0x6fb5e1f0 -> 0x6fb34df0).
 * D2Game.dll 0x6FC3EFC0 layout: `[0x7D, u8 ownerType, u32 ownerId, u32 itemId, u32 flag, u32 enabled]`,
 * sent from InvMode.cpp with `flag` = IFLAG_BROKEN (0x100) / IFLAG_REPAIRED (0x200).
 */
export function decode0x7DSetItemState(pkt: Uint8Array): ServerEvent {
  if (pkt.length < 18) throw new RangeError(`0x7D SetItemState: expected at least 18 bytes, got ${pkt.length}`)
  const r = new ByteReader(pkt)
  r.u8() // 0x7D
  const ownerType = r.u8()
  const ownerId = r.u32LE()
  const itemId = r.u32LE()
  const flag = r.u32LE()
  const enabled = r.u32LE()
  return {
    type: 'ItemFlagUpdate',
    ownerType,
    ownerId,
    itemId,
    flag,
    enabled,
  }
}
