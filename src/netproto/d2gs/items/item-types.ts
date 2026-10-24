import type {
  ItemActionId,
  ItemBaseStatEntry,
  ItemContainer,
  ItemData,
  ItemDataTables,
  ItemQuality,
  ItemStat,
  ItemStatCostField,
  UnitType,
} from '../../domain/ids.ts'
import { unitTypeToId } from '../../domain/ids.ts'

export type {
  ItemActionId,
  ItemBaseStatEntry,
  ItemContainer,
  ItemData,
  ItemDataTables,
  ItemQuality,
  ItemStat,
  ItemStatCostField,
}

export const ITEM_FLAG_EQUIPPED = 0x00000001
export const ITEM_FLAG_INSOCKET = 0x00000008
export const ITEM_FLAG_IDENTIFIED = 0x00000010
export const ITEM_FLAG_DELETED = 0x00000020
export const ITEM_FLAG_SWITCHIN = 0x00000040
export const ITEM_FLAG_SWITCHOUT = 0x00000080
export const ITEM_FLAG_BROKEN = 0x00000100
export const ITEM_FLAG_SOCKETED = 0x00000800
export const ITEM_FLAG_NEWITEM = 0x00002000
export const ITEM_FLAG_ISEAR = 0x00010000
export const ITEM_FLAG_STARTERITEM = 0x00020000
export const ITEM_FLAG_COMPACT = 0x00200000
export const ITEM_FLAG_ETHEREAL = 0x00400000
export const ITEM_FLAG_PERSONALIZED = 0x01000000
export const ITEM_FLAG_SIMPLE_EXTENDED = 0x02000000
export const ITEM_FLAG_RUNEWORD = 0x04000000

/**
 * Resolves the logical `ItemContainer` from D2GS `0x9C` / `0x9D` header fields (`action`, `ownerType`)
 * and bitstream fields (`location`, `storePage`).
 */
export function resolveItemContainer(
  opcode: 0x9c | 0x9d,
  action: number,
  ownerType: UnitType | undefined,
  location: number,
  storePage: number,
): ItemContainer {
  // Socket actions (0x0A PutInSocket, 0x13 ItemInSocket) or location 6
  if (action === 0x0a || action === 0x13 || location === 6) {
    return 'socket'
  }
  // Cursor actions (0x01 GroundToCursor, 0x12 ToCursor on login/rejoin per D2Game.dll 0x6fc3efa0,
  // 0x16 D2Client.dll 0x6fb33790) or location 4 (IMODE_ONCURSOR, including 0x02 from INVMODE_PutInCursor
  // on Charsi Imbue 0x6fce0310 and 0x09 SwapBodyItem IFLAG_SWITCHOUT 0x6fb34300)
  if (
    action === 0x01 ||
    action === 0x12 ||
    action === 0x16 ||
    (location === 4 && action !== 0x03)
  ) {
    return 'cursor'
  }
  // Ground actions (0x00 AddToGround, 0x02 DropToGround, 0x03 OnGround) or location 3/5
  if (action === 0x00 || action === 0x02 || action === 0x03 || location === 3 || location === 5) {
    return 'ground'
  }
  // Shop actions (0x0B AddToShop, 0x0C RemoveFromShop)
  if (action === 0x0b || action === 0x0c) {
    return 'shop'
  }
  // Belt actions (0x0E, 0x0F, 0x10, 0x11) or location 2
  if (action === 0x0e || action === 0x0f || action === 0x10 || action === 0x11 || location === 2) {
    return 'belt'
  }
  // Equipped on Merc (0x9D with ownerType === 1 Monster/Merc)
  if (opcode === 0x9d && ownerType !== undefined && unitTypeToId(ownerType) === 1) {
    return 'merc'
  }
  // Equipped on Player (0x06 Equip, 0x07, 0x08, 0x09 or location 1)
  if (action === 0x06 || action === 0x07 || action === 0x08 || action === 0x09 || location === 1) {
    return 'equipment'
  }
  // Stored in container (location === 0):
  // Raw 3-bit storePage in bitstream (`bInvPage + 1`, D2Common.dll 0x6fd7c158 / 0x6fd7a6d0):
  // 1 = Inventory (bInvPage 0), 2 = Partner Trade Offer (bInvPage 1), 3 = Self Trade Offer (bInvPage 2),
  // 4 = Cube (bInvPage 3), 5 = Stash (bInvPage 4)
  switch (storePage) {
    case 1:
    case 0:
      return 'inventory'
    case 2:
    case 3:
      return 'trade'
    case 4:
      return 'cube'
    case 5:
      return 'stash'
    default:
      return 'inventory'
  }
}
