/**
 * D2GS C->S NPC Chat, Shop, Repair, Gamble, IdentifyAll, and Merc Packet Builders (0x2F..0x38, 0x62, 1.13c).
 */

import { ByteWriter } from '../../core/byte-writer.ts'
import { unitTypeToId, type UnitRef } from '../../domain/ids.ts'
import { validateC2sPacket } from '../framing-c2s.ts'

/** 0x2F InitEntityChat (9B): u8 0x2F | u32 unitType (1) | u32 npcId */
export function encodeC2sNpcInit(target: UnitRef): Uint8Array {
  const w = new ByteWriter(9)
  w.u8(0x2f)
  w.u32LE(unitTypeToId(target.unitType) >>> 0)
  w.u32LE(target.id >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x30 TerminateEntityChat (9B): u8 0x30 | u32 unitType (1) | u32 npcId */
export function encodeC2sNpcCancel(target: UnitRef | number): Uint8Array {
  const unitType = typeof target === 'number' ? 1 : unitTypeToId(target.unitType)
  const id = typeof target === 'number' ? target : target.id
  const w = new ByteWriter(9)
  w.u8(0x30)
  w.u32LE(unitType >>> 0)
  w.u32LE(id >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x31 QuestMessage (9B, D2Client.dll 0x6faea250): u8 0x31 | u32 npcId | u16 stringId | u16 0 */
export function encodeC2sQuestMessage(npcId: number, messageId: number): Uint8Array {
  const w = new ByteWriter(9)
  w.u8(0x31)
  w.u32LE(npcId >>> 0)
  w.u16LE(messageId & 0xffff)
  w.u16LE((messageId >>> 16) & 0xffff)
  return validateC2sPacket(w.toUint8Array())
}

function requireU32(name: string, v: number): number {
  if (!Number.isInteger(v) || v < 0 || v > 0xffffffff) throw new RangeError(`${name}: invalid u32 ${v}`)
  return v >>> 0
}

function requireU16(name: string, v: number): number {
  if (!Number.isInteger(v) || v < 0 || v > 0xffff) throw new RangeError(`${name}: invalid u16 ${v}`)
  return v
}

/** 0x32 field3 bit: gamble purchase (D2Client global [0x6fbc97a8] set while the gamble window is open). */
export const NPC_BUY_FLAG_GAMBLE = 0x00000002
/** 0x32 field3 bit: shift+right-click fill buy (ItemsTxt +0x1a5 quantity-fill items; D2Client 0x6faf6ee0). */
export const NPC_BUY_FLAG_SHIFT_FILL = 0x80000000

export interface NpcBuyParams {
  readonly npcId: number
  readonly itemId: number
  /** Shop item UnitAny.dwMode (u16) as seen by the client; packed into the high word of field3. */
  readonly itemMode: number
  readonly gamble: boolean
  readonly shiftFill: boolean
  /** Client-side cost (D2Common #10107 type 0/2); the server recomputes the price itself. */
  readonly cost: number
}

/**
 * 0x32 BuyItem (17B): u8 0x32 | u32 npcId | u32 itemId | u32 field3 | u32 cost.
 * field3 = (itemMode << 16) | (gamble ? 2 : 0) | (shiftFill ? 0x80000000 : 0) (D2Client 0x6faf6ee0;
 * D2Game 0x6fcef220 splits `&0x80000000`, `&0x7fffffff`, `>>16` before calling 0x6fcdf200).
 */
export function encodeC2sNpcBuy(p: NpcBuyParams): Uint8Array {
  const field3 =
    ((requireU16('NpcBuy.itemMode', p.itemMode) << 16) |
      (p.gamble ? NPC_BUY_FLAG_GAMBLE : 0) |
      (p.shiftFill ? NPC_BUY_FLAG_SHIFT_FILL : 0)) >>>
    0
  const w = new ByteWriter(17)
  w.u8(0x32)
  w.u32LE(requireU32('NpcBuy.npcId', p.npcId))
  w.u32LE(requireU32('NpcBuy.itemId', p.itemId))
  w.u32LE(field3)
  w.u32LE(requireU32('NpcBuy.cost', p.cost))
  return validateC2sPacket(w.toUint8Array())
}

export interface NpcSellParams {
  readonly npcId: number
  readonly itemId: number
  /** Sold item UnitAny.dwMode (u16); D2Game only reads WORD@9 of field3. */
  readonly itemMode: number
  /** Client-side sell price (D2Common #10107 type 1); the server recomputes the price itself. */
  readonly cost: number
}

/** 0x33 SellItem (17B): u8 0x33 | u32 npcId | u32 itemId | u32 field3 (= itemMode) | u32 cost (D2Client 0x6fb46d5f). */
export function encodeC2sNpcSell(p: NpcSellParams): Uint8Array {
  const w = new ByteWriter(17)
  w.u8(0x33)
  w.u32LE(requireU32('NpcSell.npcId', p.npcId))
  w.u32LE(requireU32('NpcSell.itemId', p.itemId))
  w.u32LE(requireU16('NpcSell.itemMode', p.itemMode))
  w.u32LE(requireU32('NpcSell.cost', p.cost))
  return validateC2sPacket(w.toUint8Array())
}

/** 0x34 CainIdentifyItems (5B): u8 0x34 | u32 npcId */
export function encodeC2sNpcIdentifyAll(npcId: number): Uint8Array {
  const w = new ByteWriter(5)
  w.u8(0x34)
  w.u32LE(npcId >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x35 field4 sign bit: repair every equipped/inventory item (D2Game 0x6fcdde60, price D2Common #10071). */
export const NPC_REPAIR_ALL_FLAG = 0x80000000

export interface NpcRepairItemParams {
  readonly npcId: number
  readonly itemId: number
  /** Item UnitAny.dwMode (u16). */
  readonly itemMode: number
  /** Current durability (item stat 72) as read by the client via D2Common #10973. */
  readonly durability: number
}

/** 0x35 Repair single item (17B): u8 0x35 | u32 npcId | u32 itemId | u32 itemMode | u32 durability. */
export function encodeC2sNpcRepairItem(p: NpcRepairItemParams): Uint8Array {
  const durability = requireU32('NpcRepairItem.durability', p.durability)
  if ((durability & NPC_REPAIR_ALL_FLAG) !== 0) {
    throw new RangeError('NpcRepairItem: durability must not set the repair-all sign bit')
  }
  const w = new ByteWriter(17)
  w.u8(0x35)
  w.u32LE(requireU32('NpcRepairItem.npcId', p.npcId))
  w.u32LE(requireU32('NpcRepairItem.itemId', p.itemId))
  w.u32LE(requireU16('NpcRepairItem.itemMode', p.itemMode))
  w.u32LE(durability)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x35 Repair all (17B): u8 0x35 | u32 npcId | u32 0 | u32 0 | u32 0x80000000 (D2Client 0x6faf7dff clears itemId). */
export function encodeC2sNpcRepairAll(npcId: number): Uint8Array {
  const w = new ByteWriter(17)
  w.u8(0x35)
  w.u32LE(requireU32('NpcRepairAll.npcId', npcId))
  w.u32LE(0)
  w.u32LE(0)
  w.u32LE(NPC_REPAIR_ALL_FLAG)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x36 HireMerc (9B): u8 0x36 | u32 npcId | u32 mercId */
export function encodeC2sHireMerc(npcId: number, mercId: number): Uint8Array {
  const w = new ByteWriter(9)
  w.u8(0x36)
  w.u32LE(npcId >>> 0)
  w.u32LE(mercId >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

export const encodeC2sNpcMercHire = encodeC2sHireMerc

/**
 * 0x37 IdentifyFromGamble (5B, D2Client.dll -> D2Game.dll 0x6fc86c30 -> 0x6fcca990):
 * u8 0x37 | u32LE itemId
 */
export function encodeC2sNpcIdentifyGamble(itemId: number): Uint8Array {
  const w = new ByteWriter(5)
  w.u8(0x37)
  w.u32LE(requireU32('NpcIdentifyGamble.itemId', itemId))
  return validateC2sPacket(w.toUint8Array())
}

/**
 * 0x38 EntityAction action values handled by D2Game.dll 0x6fce00c0 (via C2S handler 0x6fcefb30):
 * - 1 Trade: vendor classes -> 0x6fcdf810(gamble = 0) fills the shop.
 * - 2 Gamble: classes 147/199/254/405/512/514 -> 0x6fcdf810(gamble = 1).
 * - 3 Hire: 0x6fcdd330 (mercenary list).
 * D2Client sends both trade (0x6fafb1e6) and gamble (0x6fafae85) with complement 0.
 */
export const NpcActionId = {
  Trade: 1,
  Gamble: 2,
  Hire: 3,
  OpenHireList: 3,
} as const

/** 0x38 EntityAction (13B): u8 0x38 | u32 action | u32 npcId | u32 complement */
export function encodeC2sNpcEntityAction(action: number, npcId: number, complement = 0): Uint8Array {
  const w = new ByteWriter(13)
  w.u8(0x38)
  w.u32LE(requireU32('NpcEntityAction.action', action))
  w.u32LE(requireU32('NpcEntityAction.npcId', npcId))
  w.u32LE(requireU32('NpcEntityAction.complement', complement))
  return validateC2sPacket(w.toUint8Array())
}

/** 0x62 ResurrectMerc (5B): u8 0x62 | u32 npcId */
export function encodeC2sNpcResurrectMerc(npcId: number): Uint8Array {
  const w = new ByteWriter(5)
  w.u8(0x62)
  w.u32LE(npcId >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

export const encodeC2sNpcMercResurrect = encodeC2sNpcResurrectMerc

/**
 * 0x4D PlayNpcMessage (3B): u8 0x4D | u16LE classId (MonStats hcIdx).
 * 0x39 PlayNpcMessage (9B): u8 0x39 | u32LE npcId | u32LE messageId (per D2Client 0x6fb54b80).
 */
export function encodeC2sPlayNpcMessage(
  classIdOrCmd:
    | number
    | {
        readonly classId?: number | undefined
        readonly npcClassId?: number | undefined
        readonly hcIdx?: number | undefined
        readonly messageId?: number | undefined
        readonly npcId?: number | undefined
        readonly unitId?: number | undefined
      },
): Uint8Array {
  if (
    typeof classIdOrCmd === 'object' &&
    classIdOrCmd !== null &&
    'messageId' in classIdOrCmd &&
    typeof classIdOrCmd.messageId === 'number'
  ) {
    const npcId = classIdOrCmd.npcId ?? classIdOrCmd.unitId ?? 0
    const w = new ByteWriter(9)
    w.u8(0x39)
    w.u32LE(npcId >>> 0)
    w.u32LE(classIdOrCmd.messageId >>> 0)
    return validateC2sPacket(w.toUint8Array())
  }
  const rawClassId =
    typeof classIdOrCmd === 'number'
      ? classIdOrCmd
      : (classIdOrCmd.classId ?? classIdOrCmd.npcClassId ?? classIdOrCmd.hcIdx ?? 0)
  const w = new ByteWriter(3)
  w.u8(0x4d)
  w.u16LE(requireU16('PlayNpcMessage.classId', rawClassId))
  return validateC2sPacket(w.toUint8Array())
}

export const encode0x4DPlayNpcMessage = encodeC2sPlayNpcMessage
export const encode0x39PlayNpcMessage = (npcId: number, messageId: number) =>
  encodeC2sPlayNpcMessage({ npcId, messageId })
