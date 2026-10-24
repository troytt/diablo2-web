/**
 * D2GS C->S Item Manipulation Packet Builders (0x16..0x28, 1.13c).
 */

import { ByteWriter } from '../../core/byte-writer.ts'
import type { Pt } from '../../domain/ids.ts'
import { validateC2sPacket } from '../framing-c2s.ts'

/** 0x16 PickItem (13B): u8 0x16 | u32 4 | u32 itemId | u32 toCursor (0=inv, 1=cursor) */
export function encodeC2sItemPickup(itemId: number, toCursor = false): Uint8Array {
  const w = new ByteWriter(13)
  w.u8(0x16)
  w.u32LE(4)
  w.u32LE(itemId >>> 0)
  w.u32LE(toCursor ? 1 : 0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x17 DropItem (5B): u8 0x17 | u32 itemId */
export function encodeC2sItemDrop(itemId: number): Uint8Array {
  const w = new ByteWriter(5)
  w.u8(0x17)
  w.u32LE(itemId >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x50 DropGold (9B, `C2S_PACKET_SIZES[0x50] = 9`): u8 0x50 | u32 playerUnitId | u32 amount */
export function encodeC2sDropGold(unitId: number, amount: number): Uint8Array {
  const w = new ByteWriter(9)
  w.u8(0x50)
  w.u32LE(unitId >>> 0)
  w.u32LE(amount >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x18 InsertItemToBuffer (17B): u8 0x18 | u32 itemId | u32 x | u32 y | u32 bufferType */
export function encodeC2sItemPlace(itemId: number, x: number, y: number, buffer: number): Uint8Array {
  const w = new ByteWriter(17)
  w.u8(0x18)
  w.u32LE(itemId >>> 0)
  w.u32LE(x >>> 0)
  w.u32LE(y >>> 0)
  w.u32LE(buffer >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x19 RemoveItemFromBuffer (5B): u8 0x19 | u32 itemId */
export function encodeC2sItemToCursor(itemId: number): Uint8Array {
  const w = new ByteWriter(5)
  w.u8(0x19)
  w.u32LE(itemId >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x1A EquipItem (9B): u8 0x1A | u32 itemId | u16 slot | u16 0 */
export function encodeC2sItemEquip(itemId: number, slot: number): Uint8Array {
  const w = new ByteWriter(9)
  w.u8(0x1a)
  w.u32LE(itemId >>> 0)
  w.u16LE(slot & 0xffff)
  w.u16LE(0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x1C UnequipItem (3B): u8 0x1C | u16 slot */
export function encodeC2sItemUnequip(slot: number): Uint8Array {
  const w = new ByteWriter(3)
  w.u8(0x1c)
  w.u16LE(slot & 0xffff)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x1D SwapCursorBodyItem (9B): u8 0x1D | u32 itemId | u16 slot | u16 0 */
export function encodeC2sItemSwap(itemId: number, slot: number): Uint8Array {
  const w = new ByteWriter(9)
  w.u8(0x1d)
  w.u32LE(itemId >>> 0)
  w.u16LE(slot & 0xffff)
  w.u16LE(0)
  return validateC2sPacket(w.toUint8Array())
}

export const encodeC2sSwapBodyItem = encodeC2sItemSwap
export const encodeC2sSwapEquippedItem = encodeC2sItemSwap

/** 0x1B Swap2HandedItem (9B, D2Game.dll 0x6fc853c0 sInsertItemBodyRmvOpp): u8 0x1B | u32 itemId | u16 slot | u16 0 */
export function encodeC2sSwap2HandedItem(itemId: number, slot: number): Uint8Array {
  const w = new ByteWriter(9)
  w.u8(0x1b)
  w.u32LE(itemId >>> 0)
  w.u16LE(slot & 0xffff)
  w.u16LE(0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x1E SwapTwo1HandedWithOne2HandedItem (9B, D2Game.dll 0x6fc85690 sDoubleSwapItemBody): u8 0x1E | u32 itemId | u16 slot | u16 0 */
export function encodeC2sSwapTwo1HandedWithOne2HandedItem(itemId: number, slot: number): Uint8Array {
  const w = new ByteWriter(9)
  w.u8(0x1e)
  w.u32LE(itemId >>> 0)
  w.u16LE(slot & 0xffff)
  w.u16LE(0)
  return validateC2sPacket(w.toUint8Array())
}

export const encodeC2sSwap2HandedDual = encodeC2sSwapTwo1HandedWithOne2HandedItem

/** 0x1F SwapContainerItem (17B): u8 0x1F | u32 cursorItemId | u32 targetItemId | u32 x | u32 y */
export function encodeC2sSwapContainerItem(
  cursorItemId: number,
  targetItemId: number,
  x: number,
  y: number,
): Uint8Array {
  const w = new ByteWriter(17)
  w.u8(0x1f)
  w.u32LE(cursorItemId >>> 0)
  w.u32LE(targetItemId >>> 0)
  w.u32LE(x >>> 0)
  w.u32LE(y >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x20 UseInventoryItem (13B): u8 0x20 | u32 itemId | u32 x | u32 y */
export function encodeC2sItemUse(itemId: number, at: Pt): Uint8Array {
  const w = new ByteWriter(13)
  w.u8(0x20)
  w.u32LE(itemId >>> 0)
  w.u32LE(at.x >>> 0)
  w.u32LE(at.y >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x23 PutItemInBelt (9B): u8 0x23 | u32 itemId | u32 slot */
export function encodeC2sBeltPut(itemId: number, slot: number): Uint8Array {
  const w = new ByteWriter(9)
  w.u8(0x23)
  w.u32LE(itemId >>> 0)
  w.u32LE(slot >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x24 RemoveItemFromBelt (5B): u8 0x24 | u32 itemId */
export function encodeC2sBeltRemove(itemId: number): Uint8Array {
  const w = new ByteWriter(5)
  w.u8(0x24)
  w.u32LE(itemId >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x25 SwapBeltItem (9B): u8 0x25 | u32 cursorItemId | u32 beltItemId */
export function encodeC2sBeltSwap(cursorItemId: number, beltItemId: number): Uint8Array {
  const w = new ByteWriter(9)
  w.u8(0x25)
  w.u32LE(cursorItemId >>> 0)
  w.u32LE(beltItemId >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x26 UseBeltItem (13B): u8 0x26 | u32 itemId | u32 shift | u32 0 */
export function encodeC2sBeltUse(itemId: number, shift: boolean | number = false): Uint8Array {
  const w = new ByteWriter(13)
  w.u8(0x26)
  w.u32LE(itemId >>> 0)
  w.u32LE(shift ? 1 : 0)
  w.u32LE(0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x27 IdentifyItem (9B): u8 0x27 | u32 itemId | u32 scrollId */
export function encodeC2sIdentifyItem(itemId: number, scrollId: number): Uint8Array {
  const w = new ByteWriter(9)
  w.u8(0x27)
  w.u32LE(itemId >>> 0)
  w.u32LE(scrollId >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x28 SocketItem (9B): u8 0x28 | u32 itemId | u32 targetItemId */
export function encodeC2sSocketItem(itemId: number, targetItemId: number): Uint8Array {
  const w = new ByteWriter(9)
  w.u8(0x28)
  w.u32LE(itemId >>> 0)
  w.u32LE(targetItemId >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x29 ScrollToBook (9B): u8 0x29 | u32 scrollId | u32 bookId */
export function encodeC2sScrollToBook(scrollId: number, bookId: number): Uint8Array {
  const w = new ByteWriter(9)
  w.u8(0x29)
  w.u32LE(scrollId >>> 0)
  w.u32LE(bookId >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x2A ItemToCubeIndirect (9B, D2Client.dll 0x6fb4712a / D2Game.dll 0x6fc866e0): u8 0x2A | u32 itemId | u32 cubeId */
export function encodeC2sItemToCube(itemId: number, cubeId: number): Uint8Array {
  const w = new ByteWriter(9)
  w.u8(0x2a)
  w.u32LE(itemId >>> 0)
  w.u32LE(cubeId >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x61 MercItem (3B): u8 0x61 | u16 slot */
export function encodeC2sMercItem(slot: number): Uint8Array {
  const w = new ByteWriter(3)
  w.u8(0x61)
  w.u16LE(slot & 0xffff)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x3E SelectMainItem (5B, D2Client.dll 0x6fb2f20b -> D2Game.dll 0x6fc56070): u8 0x3E | u32 itemId */
export function encodeC2sSelectMainItem(itemId: number): Uint8Array {
  const w = new ByteWriter(5)
  w.u8(0x3e)
  w.u32LE(itemId >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x63 ItemToBelt (5B, D2Client.dll 0x6fb46ff8 / D2Game.dll 0x6fc86530): u8 0x63 | u32 itemId */
export function encodeC2sItemToBelt(itemId: number): Uint8Array {
  const w = new ByteWriter(5)
  w.u8(0x63)
  w.u32LE(itemId >>> 0)
  return validateC2sPacket(w.toUint8Array())
}


