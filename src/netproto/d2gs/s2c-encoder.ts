/**
 * D2GS S->C ServerEvent Encoder (`#1778`).
 *
 * Exhaustively encodes all 44 `ServerEvent` variants (plus legacy test/engine aliases) into
 * exact 1.13c D2GS S->C wire packets verified against `D2Net.dll` (`0x6fbfa900` / `0x6fbf6750`)
 * and `D2Client.dll` (`0x6fb8de60`), with zero `[0x04]` (`LoadDone`) dummy fallbacks.
 */

import { BitWriter } from '../core/bit-writer.ts'
import { ByteWriter } from '../core/byte-writer.ts'
import { resolveTextCodec } from '../core/text-codec.ts'
import {
  unitTypeToId,
  type ItemContainer,
  type ItemData,
  type ItemDataTables,
  type ItemQualityLevel,
  type ItemStat,
  type UnitType,
} from '../domain/ids.ts'
import type { ServerEvent } from '../domain/server-event.ts'
import { resolveFramedS2cPacketSize } from './framing-s2c.ts'
import { encodeD2gsItemPacket } from './items/item-bitstream.ts'
import {
  ITEM_FLAG_COMPACT,
  ITEM_FLAG_DELETED,
  ITEM_FLAG_EQUIPPED,
  ITEM_FLAG_IDENTIFIED,
  ITEM_FLAG_INSOCKET,
  ITEM_FLAG_RUNEWORD,
  ITEM_FLAG_SOCKETED,
  resolveItemContainer,
} from './items/item-types.ts'
import { encode0xA3AuraSkill } from './s2c/misc.ts'
import {
  encode0x5BPlayerInGame,
  encode0x5CPlayerLeftGame,
  encode0x75PlayerPartyInfo,
  encode0x7FPartyMemberPulse,
  encode0x8BPartyInvite,
  encode0x8CPlayerRelation,
  encode0x8DAssignPlayerToParty,
  encode0x90MapPartyPulse,
} from './s2c/party.ts'
import { encode0x11UnitOverlay, encode0xACAssignNpc } from './s2c/units.ts'
import {
  encode0x18LifeManaRegen,
  encode0x1D_0x1E_0x1FStat,
  encode0x95LifeMana,
} from './s2c/stats.ts'
import { encode0x63WaypointMenu } from './s2c/waypoint.ts'
import { getDefault113cItemDataTables } from './tables/item-tables-113c.ts'
import { S2C_PACKET_SIZES } from './tables/s2c-sizes.ts'

/**
 * Inverse of `MONSTER_CMD_TO_MODE` (`D2Client.dll` `0x6fb82e68` / `D2Game.dll` `0x6fd1a718`):
 * maps canonical `MonMode.txt` ID (`0..16`) to `0x69` monster command byte (`0x00..0x1D`).
 */
const MONSTER_MODE_TO_CMD: Readonly<Record<number, number>> = {
  0: 0x08, // DT (Death)
  1: 0x07, // NU (Neutral)
  2: 0x01, // WL (Walk)
  3: 0x06, // GH (Get Hit)
  4: 0x0b, // A1 (Attack 1)
  5: 0x11, // A2 (Attack 2)
  6: 0x12, // BL (Block)
  7: 0x04, // SC (SkillCast)
  8: 0x0c, // S1 (Skill 1)
  9: 0x0e, // S2 (Skill 2)
  10: 0x1a, // S3 (Skill 3)
  11: 0x1c, // S4 (Skill 4)
  12: 0x09, // DD (Dead)
  13: 0x14, // KB (Knockback)
  14: 0x15, // XX (Sequence)
  15: 0x17, // RN (Run)
  16: 0x02, // Special
}

/**
 * Inverse of `map0x0DCodeToPlrMode` (`D2Game.dll` `0x6fd22ce0` / `D2Client.dll` `0x6fac9830`):
 * maps `PlrMode` (`0..19`) to `0x0D PlayerStop` command byte (`pkt[6]`).
 */
function mapPlrModeTo0x0DCode(mode: number | undefined): number {
  switch (mode) {
    case 0:
      return 0x08 // DT (Death)
    case 17:
      return 0x09 // DD (Dead)
    case 4:
      return 0x06 // GH (Get Hit)
    case 9:
      return 0x12 // BL (Block)
    case 19:
      return 0x13 // KB (Knockback)
    case 13:
      return 0x19 // S1 (Skill 1)
    default:
      return 0x07 // Neutral / TownNeutral
  }
}

function toWireUnitType(raw: UnitType | number | undefined, fallback = 0): number {
  if (raw === undefined) return fallback & 0xff
  if (typeof raw === 'number') return raw & 0xff
  return unitTypeToId(raw)
}

function toUnsignedVelocityByte(v: number | undefined): number {
  if (v === undefined || v === 0) return 0
  return v & 0xff
}

function writeStateStats(bw: BitWriter, stats: readonly ItemStat[] | undefined, tables: ItemDataTables, complete = true): void {
  if (stats) {
    for (const st of stats) {
      const entry = tables.getStatCost(st.statId)
      if (!entry || entry.sendBits <= 0) continue
      bw.writeBits(st.statId & 0x1ff, 9)
      if (entry.sendParamBits > 0) {
        bw.writeBits(st.param >>> 0, entry.sendParamBits)
      }
      bw.writeBits(st.value >>> 0, entry.sendBits)
    }
  }
  if (complete) {
    bw.writeBits(0x1ff, 9)
  }
}

function encode0x3EUpdateItemStats(
  itemId: number,
  stat: number,
  value: number,
  param = 0,
  flag = 0,
): Uint8Array {
  const bw = new BitWriter()
  const uItem = itemId >>> 0
  if (uItem <= 0xff) {
    bw.writeBit(0)
    bw.writeBits(uItem, 8)
  } else if (uItem <= 0xffff) {
    bw.writeBit(1)
    bw.writeBit(0)
    bw.writeBits(uItem, 16)
  } else {
    bw.writeBit(1)
    bw.writeBit(1)
    bw.writeBits(uItem, 32)
  }

  bw.writeBit(flag ? 1 : 0)
  bw.writeBits(stat & 0x1ff, 9)

  const uVal = value >>> 0
  if (uVal <= 0xff) {
    bw.writeBit(0)
    bw.writeBits(uVal, 8)
  } else if (uVal <= 0xffff) {
    bw.writeBit(1)
    bw.writeBit(0)
    bw.writeBits(uVal, 16)
  } else {
    bw.writeBit(1)
    bw.writeBit(1)
    bw.writeBits(uVal, 32)
  }

  const uParam = param >>> 0
  if (uParam <= 0xff) {
    bw.writeBit(0)
    bw.writeBits(uParam, 8)
  } else {
    bw.writeBit(1)
    bw.writeBits(uParam & 0xffff, 16)
  }

  const tail = bw.toUint8Array()
  const totalLen = 2 + tail.byteLength
  const out = new Uint8Array(totalLen)
  out[0] = 0x3e
  out[1] = totalLen & 0xff
  out.set(tail, 2)
  return out
}

function encodePlayerStatPacket(stat: number, value: number, param?: number): Uint8Array {
  return encode0x1D_0x1E_0x1FStat(stat, value, param)
}

function encodeMonsterAttrPacket(mercId: number, stat: number, value: number): Uint8Array {
  const intVal = Math.trunc(value)
  if (intVal >= 0 && intVal <= 0xff) {
    const w = new ByteWriter(7)
    w.u8(0x9e)
    w.u8(stat & 0xff)
    w.u32LE(mercId >>> 0)
    w.u8(intVal & 0xff)
    return w.toUint8Array()
  }
  if (intVal >= 0 && intVal <= 0xffff) {
    const w = new ByteWriter(8)
    w.u8(0x9f)
    w.u8(stat & 0xff)
    w.u32LE(mercId >>> 0)
    w.u16LE(intVal & 0xffff)
    return w.toUint8Array()
  }
  const w = new ByteWriter(10)
  w.u8(0xa0)
  w.u8(stat & 0xff)
  w.u32LE(mercId >>> 0)
  w.u32LE(intVal >>> 0)
  return w.toUint8Array()
}

function encodeUnitAssignEvent(
  ev: Extract<ServerEvent, { readonly type: 'UnitAssign' }> | Extract<ServerEvent, { readonly type: 'PlayerAssign' }>,
): readonly Uint8Array[] {
  if (ev.type === 'PlayerAssign') {
    const w = new ByteWriter(26)
    w.u8(0x59)
    w.u32LE(ev.unitId >>> 0)
    w.u8((ev.classId ?? ev.charClass ?? 0) & 0xff)
    w.fixedString(ev.charName ?? ev.name ?? 'Hero', 16)
    w.u16LE(ev.x & 0xffff)
    w.u16LE(ev.y & 0xffff)
    return [w.toUint8Array()]
  }

  const rawType = ev.unit?.unitType ?? ev.unitType ?? 0
  const uType = toWireUnitType(rawType, 0)
  const uId = (ev.unit?.id ?? ev.unitId ?? 1) >>> 0
  const classId = Number(ev.unit?.classId ?? ev.classId ?? 0)

  if (ev.isSelf && classId < 0) {
    const w = new ByteWriter(6)
    w.u8(0x0b)
    w.u8(uType & 0xff)
    w.u32LE(uId)
    return [w.toUint8Array()]
  }

  const x = (ev.unit?.x ?? ev.x ?? 0) & 0xffff
  const y = (ev.unit?.y ?? ev.y ?? 0) & 0xffff

  if (uType === 0) {
    const w = new ByteWriter(26)
    w.u8(0x59)
    w.u32LE(uId)
    w.u8(classId & 0xff)
    w.fixedString(ev.unit?.name ?? ev.name ?? 'Hero', 16)
    w.u16LE(x)
    w.u16LE(y)
    return [w.toUint8Array()]
  }

  if (uType === 1) {
    const uObj = ev.unit
    const ownerTypeRaw = uObj.ownerType
    const hasPlayerOwner =
      (ownerTypeRaw === 0 || ownerTypeRaw === 'player') &&
      typeof uObj.ownerId === 'number' &&
      uObj.ownerId > 0
    const hasMonsterOwner =
      !hasPlayerOwner &&
      typeof uObj.ownerId === 'number' &&
      uObj.ownerId > 0
    return [
      encode0xACAssignNpc({
        id: uId,
        classId,
        x,
        y,
        lifePct: uObj.lifePct !== undefined ? Number(uObj.lifePct) : 128,
        mode: uObj.mode !== undefined ? Number(uObj.mode) : 1,
        flags: uObj.flags !== undefined ? Number(uObj.flags) : undefined,
        isChampion: uObj.isChampion,
        isUnique: uObj.isUnique,
        isSuperUnique: uObj.isSuperUnique,
        isMinion: uObj.isMinion,
        superUniqueId: typeof uObj.superUniqueId === 'number' ? uObj.superUniqueId : undefined,
        bossMods: Array.isArray(uObj.bossMods) ? uObj.bossMods : undefined,
        nameSeed: typeof uObj.nameSeed === 'number' ? uObj.nameSeed : undefined,
        compVariants: Array.isArray(uObj.compVariants) ? uObj.compVariants : undefined,
        ownerId: hasMonsterOwner ? Number(uObj.ownerId) : undefined,
        playerOwnerId: hasPlayerOwner ? Number(uObj.ownerId) : undefined,
      }),
    ]
  }

  if (uType === 5) {
    const w = new ByteWriter(11)
    w.u8(0x09)
    w.u8(5)
    w.u32LE(uId)
    w.u8((ev.unit?.warpId ?? classId) & 0xff)
    w.u16LE(x)
    w.u16LE(y)
    return [w.toUint8Array()]
  }

  const w = new ByteWriter(14)
  w.u8(0x51)
  w.u8(uType & 0xff)
  w.u32LE(uId)
  w.u16LE(classId & 0xffff)
  w.u16LE(x)
  w.u16LE(y)
  w.u8((ev.unit?.mode ?? 0) & 0xff)
  w.u8((ev.unit?.flags ?? 0) & 0xff)
  return [w.toUint8Array()]
}

function encodeItemEvent(
  ev: Extract<ServerEvent, { readonly type: 'ItemEvent' }>,
  tables: ItemDataTables,
): readonly Uint8Array[] {
  if (ev.rawBytes instanceof Uint8Array && ev.rawBytes.byteLength >= 8) {
    return [ev.rawBytes]
  }

  // Weapon-switch tab-only sentinel without item payload uses S2C 0x97 (1B)
  if (!ev.item && ev.action === 0x17 && ev.itemId === undefined && ev.code === undefined) {
    return [new Uint8Array([0x97])]
  }

  const rawItem = (ev.item ?? {}) as Partial<ItemData>
  const container: ItemContainer = ev.container ?? rawItem.container ?? 'inventory'
  const itemId = Number(ev.itemId ?? rawItem.itemId ?? rawItem.id ?? 1) >>> 0
  const rawCodeStr = String(ev.code ?? rawItem.code ?? rawItem.rawCode ?? 'hpot')
  const trimmedCode = rawCodeStr.trim() || 'hpot'
  const paddedCode = trimmedCode.padEnd(4, ' ').slice(0, 4)

  let opcode: 0x9c | 0x9d = rawItem.opcode ?? 0x9c
  let actionNum = typeof ev.action === 'number' ? ev.action & 0xff : (rawItem.action ?? 0x04) & 0xff
  let location = rawItem.location ?? 0
  let markDeleted = false
  let clearDeleted = false

  if (typeof ev.action === 'string') {
    switch (ev.action) {
      case 'groundSpawn':
        opcode = 0x9c
        actionNum = 0x00
        location = 3
        break
      case 'drop':
        opcode = 0x9c
        actionNum = 0x02
        location = 3
        break
      case 'pickup':
        if (container === 'cursor') {
          opcode = 0x9c
          actionNum = 0x01
          location = 4
        } else if (container === 'belt') {
          opcode = 0x9c
          actionNum = 0x0e
          location = 2
        } else {
          opcode = 0x9c
          actionNum = 0x04
          location = 0
        }
        break
      case 'remove':
      case 'sell':
        if (container === 'shop') {
          opcode = 0x9c
          actionNum = 0x0c
          location = 0
        } else if (container === 'belt') {
          opcode = 0x9c
          actionNum = 0x0f
          location = 2
          markDeleted = true
        } else if (container === 'equipment' || container === 'merc') {
          opcode = 0x9d
          actionNum = 0x08
          location = 1
          markDeleted = true
        } else {
          opcode = 0x9c
          actionNum = 0x05
          location = 0
          markDeleted = true
        }
        break
      case 'vendorPool':
        opcode = 0x9c
        actionNum = 0x0b
        location = 0
        break
      case 'equip':
        opcode = 0x9d
        actionNum = 0x06
        location = 1
        break
      case 'unequip':
        opcode = 0x9d
        actionNum = 0x08
        if (container === 'cursor') {
          location = 4
          clearDeleted = true
        } else {
          location = 1
          markDeleted = true
        }
        break
      case 'beltPut':
        opcode = 0x9c
        actionNum = 0x0e
        location = 2
        break
      case 'update':
      case 'identify':
      case 'repair':
      case 'add':
      case 'move':
      case 'buy':
      case 'gamble':
      default:
        if (container === 'ground') {
          opcode = 0x9c
          actionNum = 0x00
          location = 3
        } else if (container === 'cursor') {
          opcode = 0x9c
          actionNum = 0x12
          location = 4
          clearDeleted = true
        } else if (container === 'equipment' || container === 'merc') {
          opcode = 0x9d
          actionNum = 0x06
          location = 1
        } else if (container === 'belt') {
          opcode = 0x9c
          actionNum = 0x0e
          location = 2
        } else if (container === 'socket') {
          opcode = 0x9d
          actionNum = 0x0a
          location = 6
        } else if (container === 'shop') {
          opcode = 0x9c
          actionNum = 0x0b
          location = 0
        } else {
          opcode = 0x9c
          actionNum =
            ev.action === 'update' || ev.action === 'identify' || ev.action === 'repair'
              ? 0x15
              : 0x04
          location = 0
        }
        break
    }
  } else {
    if (container === 'merc' || container === 'equipment' || container === 'socket') {
      if (
        actionNum === 0x06 ||
        actionNum === 0x07 ||
        actionNum === 0x08 ||
        actionNum === 0x09 ||
        actionNum === 0x0a ||
        actionNum === 0x13 ||
        actionNum === 0x17
      ) {
        opcode = 0x9d
      }
    }
    if (rawItem.location === undefined) {
      if (container === 'ground') location = 3
      else if (container === 'cursor') location = 4
      else if (container === 'equipment' || container === 'merc') location = 1
      else if (container === 'belt') location = 2
      else if (container === 'socket') location = 6
      else location = 0
    }
  }

  let ownerType: UnitType =
    rawItem.ownerType ?? (container === 'merc' ? 1 : container === 'socket' ? 4 : 0)
  if (container === 'merc') {
    ownerType = 1
    opcode = 0x9d
  } else if (container === 'socket') {
    ownerType = 4
    opcode = 0x9d
  }
  const ownerId = Number(ev.ownerId ?? rawItem.ownerId ?? 0) >>> 0

  let storePage = rawItem.storePage ?? rawItem.storagePage ?? 0
  if (location === 0) {
    const currentResolved = resolveItemContainer(opcode, actionNum, ownerType, location, storePage)
    if (typeof ev.action === 'string' || currentResolved !== container) {
      switch (container) {
        case 'stash':
          storePage = 5
          break
        case 'cube':
          storePage = 4
          break
        case 'tradeSelf':
          storePage = 3
          break
        case 'trade':
        case 'tradePartner':
          storePage = 2
          break
        case 'shop':
          storePage = rawItem.storePage && rawItem.storePage > 0 ? rawItem.storePage : 1
          break
        case 'inventory':
        default:
          storePage = 1
          break
      }
    }
  }

  const baseMeta = tables.getItemBaseMeta(trimmedCode) ?? tables.getItemBaseMeta(paddedCode)
  const identified = ev.identified ?? rawItem.identified ?? true
  const quality = (ev.quality ?? rawItem.quality ?? 2) as ItemQualityLevel
  const socketed = Boolean(rawItem.socketed || (rawItem.socketedItems && rawItem.socketedItems.length > 0))
  const ethereal = Boolean(rawItem.ethereal)
  const runeword = Boolean(rawItem.runeword)
  const personalized = Boolean(rawItem.personalized)
  const isEar = Boolean(rawItem.isEar)
  const stats = rawItem.stats ?? []

  const isGoldItem = trimmedCode === 'gld' || Boolean(baseMeta?.isGold)
  const isEarItem = trimmedCode === 'ear' || isEar
  const canCompactSave = Boolean(baseMeta?.compactSave)
  const hasExtendedStats = stats.some(
    (s) => s.statId !== 356 && (!isGoldItem || s.statId !== 14),
  )

  // D2Common.dll @ 0x6fd7c0c0 + Armor/Weapons/Misc.txt `compactsave`:
  // Only items with `compactsave === 1` (and no stackable/tome/magic/socketed/ethereal/runeword/personalized/unid
  // extended fields) may set `IFLAG_COMPACTSAVE` (bit 21). Gold (`gld`) and Ears (`ear`) are always compact.
  const requiresExtendedBitstream =
    !isGoldItem &&
    !isEarItem &&
    (!canCompactSave ||
      Boolean(
        baseMeta &&
          (baseMeta.kind === 'armor' ||
            baseMeta.kind === 'weapon' ||
            baseMeta.stackable ||
            baseMeta.isTome),
      ) ||
      quality !== 2 ||
      hasExtendedStats ||
      socketed ||
      ethereal ||
      runeword ||
      personalized ||
      Boolean(rawItem.isGambleMystery) ||
      !identified)

  const isCompact = requiresExtendedBitstream
    ? false
    : isGoldItem || isEarItem
      ? true
      : rawItem.compact !== undefined
        ? Boolean(rawItem.compact)
        : rawItem.simple !== undefined
          ? Boolean(rawItem.simple)
          : canCompactSave

  let rawFlags = (rawItem.rawFlags ?? rawItem.flags ?? 0) >>> 0
  if (identified) rawFlags |= ITEM_FLAG_IDENTIFIED
  else rawFlags &= ~ITEM_FLAG_IDENTIFIED

  if (isCompact) rawFlags |= ITEM_FLAG_COMPACT
  else rawFlags &= ~ITEM_FLAG_COMPACT

  if (location === 1) rawFlags |= ITEM_FLAG_EQUIPPED
  else rawFlags &= ~ITEM_FLAG_EQUIPPED

  if (location === 6) rawFlags |= ITEM_FLAG_INSOCKET
  else rawFlags &= ~ITEM_FLAG_INSOCKET

  if (socketed) rawFlags |= ITEM_FLAG_SOCKETED
  else rawFlags &= ~ITEM_FLAG_SOCKETED

  if (runeword) rawFlags |= ITEM_FLAG_RUNEWORD
  else rawFlags &= ~ITEM_FLAG_RUNEWORD

  if (markDeleted) rawFlags |= ITEM_FLAG_DELETED
  else if (clearDeleted) rawFlags &= ~ITEM_FLAG_DELETED
  rawFlags >>>= 0

  const posX = ev.at?.x ?? ev.x ?? rawItem.x ?? 0
  const posY = ev.at?.y ?? ev.y ?? rawItem.y ?? 0
  const bodyLoc = ev.bodyLoc ?? rawItem.bodyLoc ?? rawItem.equippedSlot ?? 0

  const normalizedItem: ItemData = {
    id: itemId,
    itemId,
    opcode,
    action: actionNum,
    category: rawItem.category ?? 0,
    ownerType,
    ownerId,
    flags: rawFlags,
    rawFlags,
    version: rawItem.version ?? 101,
    location,
    container,
    bodyLoc,
    equippedSlot: bodyLoc,
    gridX: location === 3 || location === 5 ? 0 : (rawItem.gridX ?? posX),
    gridY: location === 3 || location === 5 ? 0 : (rawItem.gridY ?? posY),
    storePage,
    storagePage: storePage,
    worldX: location === 3 || location === 5 ? (rawItem.worldX ?? posX) : 0,
    worldY: location === 3 || location === 5 ? (rawItem.worldY ?? posY) : 0,
    x: posX,
    y: posY,
    code: trimmedCode,
    rawCode: paddedCode,
    compact: isCompact,
    simple: isCompact,
    identified,
    socketed,
    ethereal,
    runeword,
    personalized,
    isEar,
    newItem: Boolean(rawItem.newItem),
    starterItem: Boolean(rawItem.starterItem),
    broken: Boolean(rawItem.broken),
    inSocket: location === 6,
    equipped: location === 1,
    isGambleMystery: rawItem.isGambleMystery,
    socketedChildCount: rawItem.socketedChildCount ?? rawItem.socketedItems?.length ?? 0,
    usedSockets: rawItem.usedSockets ?? rawItem.socketedItems?.length ?? 0,
    totalSockets: rawItem.totalSockets ?? rawItem.socketedItems?.length ?? 0,
    guid: rawItem.guid,
    ilvl: ev.itemLevel ?? rawItem.ilvl ?? 1,
    quality,
    graphicIndex: rawItem.graphicIndex,
    autoAffixId: rawItem.autoAffixId,
    qualitySubtype: rawItem.qualitySubtype,
    bodyPartMonsterClass: rawItem.bodyPartMonsterClass,
    magicPrefixId: rawItem.magicPrefixId,
    magicSuffixId: rawItem.magicSuffixId,
    setItemId: rawItem.setItemId,
    uniqueItemId: rawItem.uniqueItemId,
    rareName1: rawItem.rareName1,
    rareName2: rawItem.rareName2,
    rareAffixes: rawItem.rareAffixes,
    runewordData: rawItem.runewordData,
    personalizedName: rawItem.personalizedName,
    earClass: rawItem.earClass,
    earLevel: rawItem.earLevel,
    earName: rawItem.earName,
    tomeData: rawItem.tomeData,
    defense: rawItem.defense ?? baseMeta?.minDefense ?? 0,
    maxDurability: rawItem.maxDurability ?? (baseMeta?.hasDurability ? 20 : 0),
    curDurability: rawItem.curDurability ?? rawItem.durability ?? rawItem.maxDurability ?? 0,
    durability: rawItem.durability ?? rawItem.curDurability ?? rawItem.maxDurability ?? 0,
    quantity: ev.quantity ?? rawItem.quantity ?? (isGoldItem ? (rawItem.goldAmount ?? 1) : 1),
    goldAmount:
      rawItem.goldAmount ??
      stats.find((s) => s.statId === 14)?.value ??
      (isGoldItem ? (ev.quantity ?? rawItem.quantity ?? 1) : undefined),
    invWidth: rawItem.invWidth ?? baseMeta?.invWidth ?? 1,
    invHeight: rawItem.invHeight ?? baseMeta?.invHeight ?? 1,
    stats,
    setBonusStats: rawItem.setBonusStats ?? [],
    runewordStats: rawItem.runewordStats ?? [],
    socketedItems: rawItem.socketedItems,
  }

  return [encodeD2gsItemPacket(normalizedItem, tables)]
}

/**
 * Exhaustive typed encoder from `ServerEvent` to 1.13c S->C packets.
 */
export function encodeTypedServerEventToS2cPackets(
  ev: ServerEvent,
  tables: ItemDataTables = getDefault113cItemDataTables(),
): readonly Uint8Array[] {
  switch (ev.type) {
    case 'GameLoading':
      return [new Uint8Array([0x00])]

    case 'UnloadAct': {
      // S2C 0x12 UnloadAct is 26 bytes in D2Net.dll (0x6fbfa900) and D2Client.dll (0x6fb5c370).
      const out = new Uint8Array(26)
      out[0] = 0x12
      return [out]
    }

    case 'GameLogonAck':
      // S2C 0x02 GameLogonSuccess (1B, D2Client.dll 0x6fb5c4f0)
      return [new Uint8Array([0x02])]

    case 'PlayerAssign':
    case 'UnitAssign':
      return encodeUnitAssignEvent(ev)

    case 'ProtocolSync': {
      const op = ev.opcode & 0xff
      if (op === 0x16) {
        const entries = ev.entries ?? []
        if (entries.length === 0) return []
        const count = Math.min(55, entries.length)
        const totalLen = 4 + count * 9
        const w = new ByteWriter(totalLen)
        w.u8(0x16)
        w.u16LE(totalLen)
        w.u8(count)
        for (let i = 0; i < count; i++) {
          const entry = entries[i]!
          w.u8(toWireUnitType(entry.unitType, 0))
          w.u32LE(entry.id >>> 0)
          w.u16LE(entry.x & 0xffff)
          w.u16LE(entry.y & 0xffff)
        }
        return [w.toUint8Array()]
      }
      if (op === 0x57 && ev.monsterEnchant) {
        const m = ev.monsterEnchant
        const w = new ByteWriter(14)
        w.u8(0x57)
        w.u32LE(m.monsterId >>> 0)
        w.u8(m.unitType & 0xff)
        w.u16LE(m.nameSeed & 0xffff)
        w.u8((m.bossMods[0] ?? 0) & 0xff)
        w.u8((m.bossMods[1] ?? 0) & 0xff)
        w.u8((m.bossMods[2] ?? 0) & 0xff)
        w.u8(0)
        w.u16LE(m.champion ? 1 : 0)
        return [w.toUint8Array()]
      }
      if (op === 0x5f) {
        const w = new ByteWriter(5)
        w.u8(0x5f)
        w.u32LE((ev.playerData2C ?? 0) >>> 0)
        return [w.toUint8Array()]
      }
      if (op === 0x62 && ev.unit) {
        const w = new ByteWriter(7)
        w.u8(0x62)
        w.u8(ev.unit.rawUnitType & 0xff)
        w.u32LE(ev.unit.id >>> 0)
        w.u8(0)
        return [w.toUint8Array()]
      }
      if (op === 0x92 && ev.unit) {
        const w = new ByteWriter(6)
        w.u8(0x92)
        w.u8(ev.unit.rawUnitType & 0xff)
        w.u32LE(ev.unit.id >>> 0)
        return [w.toUint8Array()]
      }
      if (op === 0x93 && ev.playerSkillUpdate) {
        const u = ev.playerSkillUpdate
        const w = new ByteWriter(8)
        w.u8(0x93)
        w.u32LE(u.playerId >>> 0)
        w.u8(u.value & 0xff)
        w.u8(u.skillGroup & 0xff)
        w.u8(u.mode & 0xff)
        return [w.toUint8Array()]
      }
      if (op === 0x98 && ev.evilHut) {
        const w = new ByteWriter(7)
        w.u8(0x98)
        w.u32LE(ev.evilHut.monsterId >>> 0)
        w.u16LE(ev.evilHut.value < 0 ? 0xffff : (ev.evilHut.value & 0xffff))
        return [w.toUint8Array()]
      }
      const fixedLen = op < S2C_PACKET_SIZES.length ? S2C_PACKET_SIZES[op]! : 0
      if (fixedLen > 0) {
        const out = new Uint8Array(fixedLen)
        out[0] = op
        return [out]
      }
      return []
    }

    case 'MonsterSpecial': {
      const w = new ByteWriter(3)
      w.u8(0xa4)
      w.u16LE(ev.classId & 0xffff)
      return [w.toUint8Array()]
    }

    case 'CreateMissile': {
      const w = new ByteWriter(32)
      const x = (ev.at?.x ?? ev.x ?? 0) >>> 0
      const y = (ev.at?.y ?? ev.y ?? 0) >>> 0
      const tx = (ev.target?.x ?? ev.targetX ?? 0) >>> 0
      const ty = (ev.target?.y ?? ev.targetY ?? 0) >>> 0
      const ownerType =
        ev.owner !== undefined
          ? toWireUnitType(ev.owner.unitType, 6)
          : ev.ownerType !== undefined
            ? toWireUnitType(ev.ownerType, 6)
            : 6
      const ownerId = (ev.owner?.id ?? ev.ownerId ?? 0xffffffff) >>> 0
      const remainingFrames = Math.max(0, Math.min(0x7fff, ev.remainingFrames ?? 25))
      w.u8(0x73)
      w.u32LE((ev.unk ?? 0) >>> 0)
      w.u16LE(ev.missileClassId & 0xffff)
      w.u32LE(x)
      w.u32LE(y)
      w.u32LE(tx)
      w.u32LE(ty)
      w.u16LE(remainingFrames)
      w.u8(ownerType & 0xff)
      w.u32LE(ownerId)
      w.u8(ev.level & 0xff)
      w.u8((ev.pierceIdx ?? 0) & 0xff)
      return [w.toUint8Array()]
    }

    case 'GameFlags': {
      const w = new ByteWriter(8)
      const diff = ev.difficulty === 1 || ev.difficulty === 2 ? ev.difficulty : 0
      const arenaFlags =
        ev.arenaFlags !== undefined
          ? ev.arenaFlags >>> 0
          : ev.hardcore
            ? 0x0800
            : 0
      w.u8(0x01)
      w.u8(diff)
      w.u32LE(arenaFlags)
      w.u8(ev.expansion === false ? 0 : 1)
      w.u8(ev.ladder ? 1 : 0)
      return [w.toUint8Array()]
    }

    case 'LoadAct': {
      const w = new ByteWriter(12)
      w.u8(0x03)
      w.u8(ev.act & 0xff)
      w.u32LE(ev.mapSeed >>> 0)
      w.u16LE(ev.areaId & 0xffff)
      w.u32LE((ev.objectSeed ?? 0) >>> 0)
      return [w.toUint8Array()]
    }

    case 'EnvironmentSync': {
      const w = new ByteWriter(10)
      w.u8(0x53)
      w.u32LE(ev.cycleIndex >>> 0)
      w.i32LE(ev.ticks | 0)
      w.u8(ev.eclipse ? 1 : 0)
      return [w.toUint8Array()]
    }

    case 'LoadComplete':
      return [new Uint8Array([0x04])]

    case 'UnloadComplete':
      return [new Uint8Array([0x05])]

    case 'GameLogout': {
      if (ev.reason !== undefined) {
        const w = new ByteWriter(5)
        w.u8(0xb4)
        w.u32LE(ev.reason >>> 0)
        return [w.toUint8Array()]
      }
      return [new Uint8Array([0x06])]
    }

    case 'CanGoToAct':
      return [new Uint8Array([0x61, ev.act & 0xff])]

    case 'OpenUi': {
      // D2Client.dll 0x6fb50250 accepts uiId in {0, 1, 4, 5, 6, 7}; 2, 3, and >7 are fatal.
      let uiId = ev.uiId & 0xff
      if (uiId === 2 || uiId === 3) uiId = 1
      else if (uiId > 7) uiId = 6
      const w = new ByteWriter(7)
      w.u8(0x58)
      w.u32LE(ev.unitId >>> 0)
      w.u8(uiId)
      w.u8((ev.extra ?? 0) & 0xff)
      return [w.toUint8Array()]
    }

    case 'RoomReveal': {
      const w = new ByteWriter(6)
      w.u8(0x07)
      w.u16LE(ev.tileX & 0xffff)
      w.u16LE(ev.tileY & 0xffff)
      w.u8(ev.areaId & 0xff)
      return [w.toUint8Array()]
    }

    case 'RoomHide': {
      const w = new ByteWriter(6)
      w.u8(0x08)
      w.u16LE(ev.tileX & 0xffff)
      w.u16LE(ev.tileY & 0xffff)
      w.u8(ev.areaId & 0xff)
      return [w.toUint8Array()]
    }

    case 'UnitRemove': {
      const uType = toWireUnitType(ev.unitType, 1)
      const uId = (ev.id ?? ev.unitId ?? 0) >>> 0
      const w = new ByteWriter(6)
      w.u8(0x0a)
      w.u8(uType & 0xff)
      w.u32LE(uId)
      return [w.toUint8Array()]
    }

    case 'UnitMove': {
      const uType = toWireUnitType(ev.unitType, 0)
      const uId = (ev.id ?? ev.unitId ?? 1) >>> 0
      const tx = (ev.to?.x ?? ev.targetX ?? ev.x ?? 0) & 0xffff
      const ty = (ev.to?.y ?? ev.targetY ?? ev.y ?? 0) & 0xffff
      const cx = (ev.from?.x ?? ev.currentX ?? ev.x ?? tx) & 0xffff
      const cy = (ev.from?.y ?? ev.currentY ?? ev.y ?? ty) & 0xffff

      // Monster / NPC movement MUST emit 0x67 / 0x68 / 0x6D (NEVER 0x0F PlayerMove, #1778).
      if (uType === 1) {
        if (ev.npc?.opcode === 0x6d || ev.mode === 'stop') {
          const life = ev.npc ? (ev.npc.s[2] & 0xff) : 128
          const w = new ByteWriter(10)
          w.u8(0x6d)
          w.u32LE(uId)
          w.u16LE(tx)
          w.u16LE(ty)
          w.u8(life)
          return [w.toUint8Array()]
        }
        if (ev.npc?.opcode === 0x68 || ev.target !== undefined) {
          const cmd =
            ev.npc?.cmd ??
            ev.moveType ??
            (ev.mode === 'run' ? 0x18 : ev.mode === 'knockback' ? 0x0e : 0x00)
          const driftX = (ev.npc?.driftCheckAt?.x ?? cx) & 0xffff
          const driftY = (ev.npc?.driftCheckAt?.y ?? cy) & 0xffff
          const targetType =
            ev.npc !== undefined
              ? (ev.npc.s[0] & 0xff)
              : ev.target !== undefined
                ? toWireUnitType(ev.target.unitType, 0)
                : 0
          const targetId =
            ev.npc !== undefined
              ? (ev.npc.s[1] >>> 0)
              : (ev.target?.id ?? 0) >>> 0
          const b0F = ev.npc ? (ev.npc.s[2] & 0xff) : 0
          const pathType = (ev.pathType ?? (ev.npc ? ev.npc.s[3] : 0)) & 0xff
          const velPct = ev.velocityPercent ?? (ev.npc ? ev.npc.s[4] : 0)
          const b14 = ev.npc ? (ev.npc.s[5] & 0xff) : 0
          const b10 = ev.npc ? ((ev.npc.s[6] ?? 0) & 0xff) : 0
          const w = new ByteWriter(21)
          w.u8(0x68)
          w.u32LE(uId)
          w.u8(cmd & 0xff)
          w.u16LE(driftX)
          w.u16LE(driftY)
          w.u8(targetType)
          w.u32LE(targetId)
          w.u8(b0F)
          w.u8(b10)
          w.u8(pathType)
          w.i16LE(velPct)
          w.u8(b14)
          return [w.toUint8Array()]
        }
        const cmd =
          ev.npc?.cmd ??
          ev.moveType ??
          (ev.mode === 'run' ? 0x17 : ev.mode === 'knockback' ? 0x0e : 0x01)
        const b0A = ev.npc ? (ev.npc.s[2] & 0xff) : 0
        const pathType = (ev.pathType ?? (ev.npc ? ev.npc.s[3] : 0)) & 0xff
        const velPct = ev.velocityPercent ?? (ev.npc ? ev.npc.s[4] : 0)
        const b0F = ev.npc ? (ev.npc.s[5] & 0xff) : 0
        const b0B = ev.npc ? ((ev.npc.s[6] ?? 0) & 0xff) : 0
        const w = new ByteWriter(16)
        w.u8(0x67)
        w.u32LE(uId)
        w.u8(cmd & 0xff)
        w.u16LE(tx)
        w.u16LE(ty)
        w.u8(b0A)
        w.u8(b0B)
        w.u8(pathType)
        w.i16LE(velPct)
        w.u8(b0F)
        return [w.toUint8Array()]
      }

      // Player movement: 0x0D stop, 0x10 move-to-target, 0x0F move-to-location
      if (ev.mode === 'stop') {
        const w = new ByteWriter(13)
        w.u8(0x0d)
        w.u8(uType & 0xff)
        w.u32LE(uId)
        w.u8(0x07)
        w.u16LE(tx)
        w.u16LE(ty)
        w.u8(0)
        w.u8(128)
        return [w.toUint8Array()]
      }
      if (ev.target !== undefined) {
        const defaultMoveType =
          ev.mode === 'walk' ? 0x00 : ev.mode === 'knockback' ? 0x14 : 0x18
        const w = new ByteWriter(16)
        w.u8(0x10)
        w.u8(uType & 0xff)
        w.u32LE(uId)
        w.u8((ev.moveType ?? defaultMoveType) & 0xff)
        w.u8(toWireUnitType(ev.target.unitType, 0))
        w.u32LE(ev.target.id >>> 0)
        w.u16LE(cx)
        w.u16LE(cy)
        return [w.toUint8Array()]
      }
      const defaultMoveType =
        ev.mode === 'walk' ? 0x01 : ev.mode === 'knockback' ? 0x13 : 0x17
      const w = new ByteWriter(16)
      w.u8(0x0f)
      w.u8(uType & 0xff)
      w.u32LE(uId)
      w.u8((ev.moveType ?? defaultMoveType) & 0xff)
      w.u16LE(tx)
      w.u16LE(ty)
      w.u8(0)
      w.u16LE(cx)
      w.u16LE(cy)
      return [w.toUint8Array()]
    }

    case 'UnitReassign': {
      const uType = toWireUnitType(ev.unitType, 0)
      const uId = (ev.id ?? ev.unitId ?? 1) >>> 0
      const x = (ev.at?.x ?? ev.x ?? 0) & 0xffff
      const y = (ev.at?.y ?? ev.y ?? 0) & 0xffff
      const w = new ByteWriter(11)
      w.u8(0x15)
      w.u8(uType & 0xff)
      w.u32LE(uId)
      w.u16LE(x)
      w.u16LE(y)
      w.u8(ev.snap ? 1 : 0)
      return [w.toUint8Array()]
    }

    case 'UnitStatUpdate': {
      const uType = toWireUnitType(ev.unitType, 0)
      const pairs: Array<readonly [number, number]> = []
      if (ev.statId !== undefined && ev.value !== undefined) {
        pairs.push([ev.statId, ev.value])
      } else if (ev.stats) {
        for (const [k, v] of Object.entries(ev.stats)) {
          const parsed = Number(k)
          if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 510) {
            pairs.push([parsed, v])
          }
        }
      }
      if (pairs.length === 0) return []
      const out: Uint8Array[] = []
      for (const [statId, value] of pairs) {
        if (uType === 4) {
          out.push(encode0x3EUpdateItemStats(ev.unitId, statId, value))
        } else if (uType === 1) {
          out.push(encodeMonsterAttrPacket(ev.unitId, statId, value))
        } else {
          const w = new ByteWriter(10)
          w.u8(0x20)
          w.u32LE(ev.unitId >>> 0)
          w.u8(statId & 0xff)
          w.u32LE(value >>> 0)
          out.push(w.toUint8Array())
        }
      }
      return out
    }

    case 'UnitState': {
      const uType = toWireUnitType(ev.unitType, 0)
      const stateNum =
        typeof ev.state === 'number' ? ev.state & 0xff : (Number(ev.state) || 0) & 0xff
      if (!ev.active) {
        const w = new ByteWriter(7)
        w.u8(0xa9)
        w.u8(uType & 0xff)
        w.u32LE(ev.unitId >>> 0)
        w.u8(stateNum)
        return [w.toUint8Array()]
      }
      const extraStats = (ev as { readonly stats?: readonly ItemStat[] }).stats
      const bw = new BitWriter()
      writeStateStats(bw, extraStats, tables, true)
      const tail = bw.toUint8Array()
      const totalLen = 8 + tail.byteLength
      const w = new ByteWriter(totalLen)
      w.u8(0xa8)
      w.u8(uType & 0xff)
      w.u32LE(ev.unitId >>> 0)
      w.u8(totalLen & 0xff)
      w.u8(stateNum)
      w.bytes(tail)
      return [w.toUint8Array()]
    }

    case 'SkillUpdate': {
      const w = new ByteWriter(12)
      w.u8(0x21)
      w.u8(0)
      w.u8(1)
      w.u32LE(ev.unitId >>> 0)
      w.u16LE(ev.skillId & 0xffff)
      w.u8(ev.level & 0xff)
      w.u8(0)
      w.u8(0)
      return [w.toUint8Array()]
    }

    case 'UnitMode': {
      const uType = toWireUnitType(ev.unitType, 0)
      const uId = ev.id >>> 0
      if (ev.npc) {
        switch (ev.npc.opcode) {
          case 0x69: {
            const w = new ByteWriter(12)
            w.u8(0x69)
            w.u32LE(uId)
            w.u8(ev.npc.cmd & 0xff)
            w.u16LE(ev.npc.s[0] & 0xffff)
            w.u16LE(ev.npc.s[1] & 0xffff)
            w.u8(ev.npc.s[2] & 0xff)
            w.u8((ev.npc.s[6] ?? 0) & 0xff)
            return [w.toUint8Array()]
          }
          case 0x6a: {
            const w = new ByteWriter(12)
            w.u8(0x6a)
            w.u32LE(uId)
            w.u8(ev.npc.cmd & 0xff)
            w.u8(ev.npc.s[0] & 0xff)
            w.u32LE(ev.npc.s[1] >>> 0)
            w.u8(ev.npc.s[2] & 0xff)
            return [w.toUint8Array()]
          }
          case 0x6b: {
            const w = new ByteWriter(16)
            w.u8(0x6b)
            w.u32LE(uId)
            w.u8(ev.npc.cmd & 0xff)
            w.u16LE(ev.npc.s[0] & 0xffff)
            w.u16LE(ev.npc.s[1] & 0xffff)
            w.u8(ev.npc.s[2] & 0xff)
            w.u8((ev.npc.s[6] ?? 0) & 0xff)
            w.u16LE((ev.npc.driftCheckAt?.x ?? 0) & 0xffff)
            w.u16LE((ev.npc.driftCheckAt?.y ?? 0) & 0xffff)
            return [w.toUint8Array()]
          }
          case 0x6c: {
            const w = new ByteWriter(16)
            w.u8(0x6c)
            w.u32LE(uId)
            w.u8(ev.npc.cmd & 0xff)
            w.u8(ev.npc.s[0] & 0xff)
            w.u32LE(ev.npc.s[1] >>> 0)
            w.u8(ev.npc.s[2] & 0xff)
            w.u16LE((ev.npc.driftCheckAt?.x ?? 0) & 0xffff)
            w.u16LE((ev.npc.driftCheckAt?.y ?? 0) & 0xffff)
            return [w.toUint8Array()]
          }
        }
      }
      if (uType === 2) {
        const w = new ByteWriter(12)
        w.u8(0x0e)
        w.u8(2)
        w.u32LE(uId)
        w.u8((ev.eventCode ?? 3) & 0xff)
        w.u8((ev.eventFlag ?? 0) & 0xff)
        w.u32LE((ev.mode ?? 0) >>> 0)
        return [w.toUint8Array()]
      }
      if (ev.mode === undefined && ev.hitClass !== undefined) {
        const w = new ByteWriter(9)
        w.u8(0x0c)
        w.u8(uType & 0xff)
        w.u32LE(uId)
        w.u8(19)
        w.u8(ev.hitClass & 0xff)
        w.u8((ev.lifePct ?? 128) & 0x7f)
        return [w.toUint8Array()]
      }
      if (uType === 1) {
        const rawCmd = MONSTER_MODE_TO_CMD[ev.mode ?? 1] ?? 0x07
        const paramByte =
          rawCmd === 0x08 || rawCmd === 0x09
            ? 0
            : rawCmd === 0x06
              ? ev.lifePct !== undefined
                ? ev.lifePct >= 128
                  ? 0x80
                  : (ev.lifePct & 0x7f)
                : 0
              : ev.lifePct !== undefined
                ? Math.max(0, Math.min(128, ev.lifePct)) & 0xff
                : 0
        const w = new ByteWriter(12)
        w.u8(0x69)
        w.u32LE(uId)
        w.u8(rawCmd)
        w.u16LE((ev.at?.x ?? 0) & 0xffff)
        w.u16LE((ev.at?.y ?? 0) & 0xffff)
        w.u8(paramByte)
        w.u8(0)
        return [w.toUint8Array()]
      }
      const w = new ByteWriter(13)
      w.u8(0x0d)
      w.u8(uType & 0xff)
      w.u32LE(uId)
      w.u8(mapPlrModeTo0x0DCode(ev.mode))
      w.u16LE((ev.at?.x ?? 0) & 0xffff)
      w.u16LE((ev.at?.y ?? 0) & 0xffff)
      w.u8((ev.hitClass ?? 0) & 0xff)
      w.u8((ev.lifePct ?? 128) & 0xff)
      return [w.toUint8Array()]
    }

    case 'UnitOverlay':
      return [
        encode0x11UnitOverlay({
          rawUnitType: ev.rawUnitType,
          id: ev.id >>> 0,
          overlayIndex: ev.overlayIndex & 0xffff,
        }),
      ]

    case 'UnitHoverTextClear': {
      const w = new ByteWriter(6)
      w.u8(0x76)
      w.u8(ev.rawUnitType & 0xff)
      w.u32LE(ev.id >>> 0)
      return [w.toUint8Array()]
    }

    case 'CorpseAssign': {
      const w = new ByteWriter(10)
      w.u8(0x74)
      w.u8(ev.assign & 0xff)
      w.u32LE(ev.ownerId >>> 0)
      w.u32LE(ev.corpseId >>> 0)
      return [w.toUint8Array()]
    }

    case 'SkillCast': {
      const casterType = toWireUnitType(ev.caster.unitType, 0)
      const casterId = ev.caster.id >>> 0
      const skill = (ev.skill ?? ev.skillId ?? 0) & 0xffff
      const level = ev.level & 0xff
      if ('unitType' in ev.target) {
        const w = new ByteWriter(16)
        w.u8(ev.triggered ? 0x99 : 0x4c)
        w.u8(casterType)
        w.u32LE(casterId)
        w.u16LE(skill)
        w.u8(level)
        w.u8(toWireUnitType(ev.target.unitType, 1))
        w.u32LE(ev.target.id >>> 0)
        w.u16LE(0)
        return [w.toUint8Array()]
      }
      const w = new ByteWriter(17)
      w.u8(ev.triggered ? 0x9a : 0x4d)
      w.u8(casterType)
      w.u32LE(casterId)
      w.u32LE(skill)
      w.u8(level)
      w.u16LE(ev.target.x & 0xffff)
      w.u16LE(ev.target.y & 0xffff)
      w.u16LE(0)
      return [w.toUint8Array()]
    }

    case 'UnitSkillEvent':
      return [
        encode0xA3AuraSkill({
          flag: ev.flag,
          skill: ev.skill,
          level: ev.level,
          caster: {
            rawUnitType: ev.caster.rawUnitType,
            id: ev.caster.id,
          },
          target: {
            rawUnitType: ev.target.rawUnitType,
            id: ev.target.id,
          },
          x: ev.x,
          y: ev.y,
        }),
      ]

    case 'StatSet': {
      if (ev.unit) {
        const uType = toWireUnitType(ev.unit.unitType, 0)
        if (uType === 4) {
          return [
            encode0x3EUpdateItemStats(
              ev.unit.id,
              ev.stat,
              ev.value,
              ev.param ?? 0,
              ev.flag ?? 0,
            ),
          ]
        }
        if (uType === 0) {
          const w = new ByteWriter(10)
          w.u8(0x20)
          w.u32LE(ev.unit.id >>> 0)
          w.u8(ev.stat & 0xff)
          w.u32LE(ev.value >>> 0)
          return [w.toUint8Array()]
        }
        if (uType === 1) {
          return [encodeMonsterAttrPacket(ev.unit.id, ev.stat, ev.value)]
        }
      }
      return [encodePlayerStatPacket(ev.stat, ev.value, ev.param)]
    }

    case 'WalkVerify': {
      const bw = new BitWriter()
      bw.writeBits(0x96, 8)
      bw.writeBits(Math.max(0, ev.stamina) & 0x7fff, 15)
      bw.writeBits(ev.x, 16)
      bw.writeBits(ev.y, 16)
      bw.writeBits(toUnsignedVelocityByte(ev.vx), 8)
      bw.writeBits(toUnsignedVelocityByte(ev.vy), 8)
      const raw = bw.toUint8Array()
      const out = new Uint8Array(9)
      out.set(raw.subarray(0, 9))
      return [out]
    }
    case 'LifeMana': {
      const x = (ev.at?.x ?? 0) & 0xffff
      const y = (ev.at?.y ?? 0) & 0xffff
      if (ev.life < 0 && ev.mana < 0) {
        const vx = toUnsignedVelocityByte(ev.vx)
        const vy = toUnsignedVelocityByte(ev.vy)
        const bw = new BitWriter()
        bw.writeBits(0x96, 8)
        bw.writeBits(Math.min(0x7fff, Math.max(0, Math.trunc(ev.stamina))), 15)
        bw.writeBits(x, 16)
        bw.writeBits(y, 16)
        bw.writeBits(vx, 8)
        bw.writeBits(vy, 8)
        const raw = bw.toUint8Array()
        const out = new Uint8Array(9)
        out.set(raw.subarray(0, 9))
        const pkts: Uint8Array[] = [out]
        if (ev.stamina > 0x7fff) {
          pkts.push(encodePlayerStatPacket(10, Math.trunc(ev.stamina) * 256))
        }
        return pkts
      }
      const basePkt =
        ev.lifeRegen !== undefined || ev.manaRegen !== undefined
          ? encode0x18LifeManaRegen({
              life: ev.life,
              mana: ev.mana,
              stamina: ev.stamina,
              lifeRegen: ev.lifeRegen,
              manaRegen: ev.manaRegen,
              x,
              y,
              vx: ev.vx,
              vy: ev.vy,
            })
          : encode0x95LifeMana({
              life: ev.life,
              mana: ev.mana,
              stamina: ev.stamina,
              x,
              y,
              vx: ev.vx,
              vy: ev.vy,
            })
      const pkts: Uint8Array[] = [basePkt]
      if (ev.life > 0x7fff) {
        pkts.push(encodePlayerStatPacket(6, Math.trunc(ev.life) * 256))
      }
      if (ev.mana > 0x7fff) {
        pkts.push(encodePlayerStatPacket(8, Math.trunc(ev.mana) * 256))
      }
      if (ev.stamina > 0x7fff) {
        pkts.push(encodePlayerStatPacket(10, Math.trunc(ev.stamina) * 256))
      }
      return pkts
    }

    case 'Experience': {
      if (ev.isDelta) {
        if (ev.value >= 0 && ev.value <= 0xff) {
          return [new Uint8Array([0x1a, ev.value & 0xff])]
        }
        if (ev.value >= 0 && ev.value <= 0xffff) {
          const w = new ByteWriter(3)
          w.u8(0x1b)
          w.u16LE(ev.value & 0xffff)
          return [w.toUint8Array()]
        }
      }
      const w = new ByteWriter(5)
      w.u8(0x1c)
      w.u32LE(ev.value >>> 0)
      return [w.toUint8Array()]
    }

    case 'StateSet': {
      const uType = toWireUnitType(ev.unit.unitType, 0)
      const uId = ev.unit.id >>> 0
      if (ev.origin === 0xa7) {
        const w = new ByteWriter(7)
        w.u8(0xa7)
        w.u8(uType)
        w.u32LE(uId)
        w.u8(ev.state & 0xff)
        return [w.toUint8Array()]
      }
      if (ev.origin === 0xaa || ev.states !== undefined) {
        const entries =
          ev.states ?? [{ state: ev.state, stats: ev.stats, complete: ev.complete ?? true }]
        const bw = new BitWriter()
        for (const entry of entries) {
          bw.writeBits(entry.state & 0xff, 8)
          const hasStats = Boolean(entry.stats && entry.stats.length > 0) || !entry.complete
          if (!hasStats) {
            bw.writeBit(0)
          } else {
            bw.writeBit(1)
            writeStateStats(bw, entry.stats, tables, entry.complete)
            if (!entry.complete) break
          }
        }
        bw.writeBits(0xff, 8)
        const tail = bw.toUint8Array()
        const totalLen = 7 + tail.byteLength
        const w = new ByteWriter(totalLen)
        w.u8(0xaa)
        w.u8(uType)
        w.u32LE(uId)
        w.u8(totalLen & 0xff)
        w.bytes(tail)
        return [w.toUint8Array()]
      }
      const bw = new BitWriter()
      writeStateStats(bw, ev.stats, tables, ev.complete ?? true)
      const tail = bw.toUint8Array()
      const totalLen = 8 + tail.byteLength
      const w = new ByteWriter(totalLen)
      w.u8(0xa8)
      w.u8(uType)
      w.u32LE(uId)
      w.u8(totalLen & 0xff)
      w.u8(ev.state & 0xff)
      w.bytes(tail)
      return [w.toUint8Array()]
    }

    case 'StateEnd': {
      const w = new ByteWriter(7)
      w.u8(0xa9)
      w.u8(toWireUnitType(ev.unit.unitType, 0))
      w.u32LE(ev.unit.id >>> 0)
      w.u8(ev.state & 0xff)
      return [w.toUint8Array()]
    }

    case 'StateSkillEffect': {
      const w = new ByteWriter(8)
      w.u8(0xa5)
      w.u8(toWireUnitType(ev.unit.unitType, 0))
      w.u32LE(ev.unit.id >>> 0)
      w.u16LE(ev.skillId & 0xffff)
      return [w.toUint8Array()]
    }

    case 'ItemEvent':
      return encodeItemEvent(ev, tables)

    case 'WeaponSwitch':
      return [new Uint8Array([0x97])]

    case 'CursorClear': {
      const w = new ByteWriter(6)
      w.u8(0x42)
      w.u8(toWireUnitType(ev.unitType, 0))
      w.u32LE(ev.id >>> 0)
      return [w.toUint8Array()]
    }

    case 'UseSpecialItem': {
      const w = new ByteWriter(6)
      w.u8(0x7c)
      w.u8(toWireUnitType(ev.unitType, 4))
      w.u32LE(ev.id >>> 0)
      return [w.toUint8Array()]
    }

    case 'ItemFlagUpdate': {
      if (ev.direct) {
        const w = new ByteWriter(13)
        w.u8(0x40)
        w.u32LE(ev.itemId >>> 0)
        w.u32LE(ev.flag >>> 0)
        w.u32LE(ev.enabled >>> 0)
        return [w.toUint8Array()]
      }
      const w = new ByteWriter(18)
      w.u8(0x7d)
      w.u8(ev.ownerType & 0xff)
      w.u32LE(ev.ownerId >>> 0)
      w.u32LE(ev.itemId >>> 0)
      w.u32LE(ev.flag >>> 0)
      w.u32LE(ev.enabled >>> 0)
      return [w.toUint8Array()]
    }

    case 'ItemRelate': {
      const w = new ByteWriter(11)
      w.u8(ev.opcode)
      w.u16LE(ev.param & 0xffff)
      w.u32LE(ev.itemId >>> 0)
      w.u32LE(ev.value >>> 0)
      return [w.toUint8Array()]
    }

    case 'SkillList': {
      const extra = ev as {
        readonly isSkillStatus?: boolean
        readonly quantity?: number
      }
      if (extra.isSkillStatus || ev.playerBodySkip !== undefined) {
        const first = ev.skills[0]
        const w = new ByteWriter(12)
        w.u8(0x22)
        w.u8(0)
        w.u8(0)
        w.u32LE(ev.unitId >>> 0)
        w.u16LE((first?.skillId ?? first?.skill ?? 0) & 0xffff)
        w.u8((extra.quantity ?? first?.level ?? 0) & 0xff)
        w.u8(0)
        w.u8(ev.playerBodySkip ? 1 : 0)
        return [w.toUint8Array()]
      }
      if (ev.flag !== undefined && ev.skills.length === 1) {
        const first = ev.skills[0]!
        const w = new ByteWriter(12)
        w.u8(0x21)
        w.u8(toWireUnitType(ev.unitType, 0))
        w.u8(ev.flag & 0xff)
        w.u32LE(ev.unitId >>> 0)
        w.u16LE((first.skillId ?? first.skill ?? 0) & 0xffff)
        w.u8((first.baseLevel ?? first.level) & 0xff)
        w.u8(0)
        w.u8(0)
        return [w.toUint8Array()]
      }
      if (ev.skills.length === 0) {
        return []
      }
      const packets: Uint8Array[] = []
      for (let start = 0; start < ev.skills.length; start += 160) {
        const chunk = ev.skills.slice(start, start + 160)
        const w = new ByteWriter(6 + chunk.length * 3)
        w.u8(0x94)
        w.u8(chunk.length & 0xff)
        w.u32LE(ev.unitId >>> 0)
        for (const sk of chunk) {
          w.u16LE((sk.skillId ?? sk.skill ?? 0) & 0xffff)
          w.u8(sk.level & 0xff)
        }
        packets.push(w.toUint8Array())
      }
      return packets
    }

    case 'ActiveSkill': {
      const extra = ev as {
        readonly isUseStackableItem?: boolean
        readonly isHotkey?: boolean
        readonly slot?: number
      }
      if (extra.isUseStackableItem) {
        const w = new ByteWriter(8)
        w.u8(0x3f)
        w.u8(ev.unitId & 0xff)
        w.u32LE((ev.itemId ?? 0xffffffff) >>> 0)
        w.u16LE(ev.skill & 0xffff)
        return [w.toUint8Array()]
      }
      if (extra.isHotkey) {
        const slot = (extra.slot ?? ev.unitId) & 0xff
        const isUnbound =
          ev.skill < 0 || ev.skill === 0xffff || (ev.skill & 0x7fff) === 0x7fff
        const word = isUnbound
          ? 0xffff
          : (ev.skill & 0x0fff) | (ev.hand === 'left' ? 0x8000 : 0)
        const w = new ByteWriter(8)
        w.u8(0x7b)
        w.u8(slot)
        w.u16LE(word & 0xffff)
        w.u32LE((ev.itemId ?? 0xffffffff) >>> 0)
        return [w.toUint8Array()]
      }
      const w = new ByteWriter(13)
      w.u8(0x23)
      w.u8(0)
      w.u32LE(ev.unitId >>> 0)
      w.u8(ev.hand === 'left' ? 1 : 0)
      w.u16LE(ev.skill & 0xffff)
      w.u32LE((ev.itemId ?? 0xffffffff) >>> 0)
      return [w.toUint8Array()]
    }

    case 'Npc':
    case 'NpcInfo': {
      const kind = ev.type === 'NpcInfo' ? 'info' : ev.kind
      const targetId = (ev.npcId ?? ev.unitId ?? 0) >>> 0
      if (kind === 'wantsInteract') {
        const w = new ByteWriter(6)
        w.u8(0x8a)
        w.u8((ev.unitType ?? 1) & 0xff)
        w.u32LE(targetId)
        return [w.toUint8Array()]
      }
      if (kind === 'heal') {
        const w = new ByteWriter(7)
        w.u8(0xab)
        w.u8((ev.unitType ?? 1) & 0xff)
        w.u32LE(targetId)
        w.u8(((ev as { readonly result?: number }).result ?? 128) & 0xff)
        return [w.toUint8Array()]
      }
      if (kind === 'menu' || kind === 'setTalk') {
        const npcEv = ev as Extract<ServerEvent, { readonly type: 'Npc' }>
        const w = new ByteWriter(26)
        w.u8(0x91)
        w.u8((npcEv.act ?? npcEv.result ?? 0) & 0xff)
        const flags = npcEv.npcFlags ?? []
        for (let i = 0; i < 12; i++) {
          w.u16LE((flags[i] ?? 0) & 0xffff)
        }
        return [w.toUint8Array()]
      }
      if (kind === 'assign') {
        const npcEv = ev as Extract<ServerEvent, { readonly type: 'Npc' }>
        return [
          encode0xACAssignNpc({
            id: targetId,
            classId: npcEv.classId ?? 0,
            x: npcEv.x ?? 0,
            y: npcEv.y ?? 0,
            lifePct: 128,
            mode: 1,
          }),
        ]
      }
      const w = new ByteWriter(40)
      w.u8(0x27)
      w.u8((ev.unitType ?? 1) & 0xff)
      w.u32LE(targetId)
      const msgs = (ev.allMessages ?? ev.messages ?? []) as ReadonlyArray<{
        readonly menu?: number
        readonly stringId?: number
        readonly msgId?: number
      }>
      const count = Math.min(8, ev.count ?? msgs.length)
      w.u8(count & 0xff)
      w.u8(0)
      for (let i = 0; i < 8; i++) {
        const entry = msgs[i]
        w.u8((entry?.menu ?? 0) & 0xff)
        w.u8(0)
        w.u16LE((entry?.stringId ?? entry?.msgId ?? 0) & 0xffff)
      }
      return [w.toUint8Array()]
    }

    case 'NpcTransaction': {
      const w = new ByteWriter(15)
      w.u8(0x2a)
      w.u8(ev.flag & 0xff)
      w.u8(ev.result & 0xff)
      w.u32LE(0)
      w.u32LE(ev.itemId >>> 0)
      w.u32LE(ev.gold >>> 0)
      return [w.toUint8Array()]
    }

    case 'WaypointMenu':
      return [
        encode0x63WaypointMenu({
          unitId: ev.unitId >>> 0,
          open: ev.open,
        }),
      ]

    case 'QuestState': {
      const src = ev.source
      if (src === 0x28 || ev.kind === 'update') {
        const w = new ByteWriter(103)
        w.u8(0x28)
        w.u8((ev.updateType ?? 0) & 0xff)
        w.u32LE((ev.unitId ?? 0) >>> 0)
        w.u8((ev.timer ?? 0) & 0xff)
        for (let i = 0; i < 48; i++) {
          w.u16LE((ev.quests[i] ?? ev.flags?.[i] ?? 0) & 0xffff)
        }
        return [w.toUint8Array()]
      }
      if (src === 0x50 || ev.kind === 'item') {
        const w = new ByteWriter(15)
        w.u8(0x50)
        for (let i = 0; i < 7; i++) {
          w.u16LE((ev.quests[i] ?? 0) & 0xffff)
        }
        return [w.toUint8Array()]
      }
      if (src === 0x52 || ev.kind === 'history') {
        const w = new ByteWriter(42)
        w.u8(0x52)
        const bytes = ev.statusBytes ?? ev.historyBytes
        for (let i = 0; i < 41; i++) {
          w.u8((bytes?.[i] ?? ev.quests[i] ?? 0) & 0xff)
        }
        return [w.toUint8Array()]
      }
      if (src === 0x5d || ev.kind === 'status') {
        const w = new ByteWriter(6)
        w.u8(0x5d)
        w.u8((ev.questStatus?.questId ?? ev.quests[0] ?? 0) & 0xff)
        w.u8((ev.questStatus?.alertFlags ?? ((ev.quests[1] ?? 0) & 0xff)) & 0xff)
        w.u8((ev.questStatus?.filterStatus ?? (((ev.quests[1] ?? 0) >>> 8) & 0xff)) & 0xff)
        w.i16LE(ev.questStatus?.extra ?? (ev.quests[2] ?? 0))
        return [w.toUint8Array()]
      }
      if (src === 0x5e || ev.kind === 'availability') {
        const out = new Uint8Array(38)
        out[0] = 0x5e
        if (ev.availabilityBytes) {
          out.set(ev.availabilityBytes.subarray(0, 37), 1)
        } else {
          const dv = new DataView(out.buffer)
          for (let i = 0; i < 18; i++) {
            dv.setUint16(1 + i * 2, (ev.quests[i] ?? 0) & 0xffff, true)
          }
        }
        return [out]
      }
      if (src === 0x89 || ev.kind === 'special') {
        return [new Uint8Array([0x89, (ev.specialEventId ?? ev.quests[0] ?? 0) & 0xff])]
      }
      const w = new ByteWriter(97)
      w.u8(0x29)
      for (let i = 0; i < 48; i++) {
        w.u16LE((ev.quests[i] ?? ev.flags?.[i] ?? 0) & 0xffff)
      }
      return [w.toUint8Array()]
    }

    case 'Party': {
      if (ev.members && ev.members.length > 0) {
        return ev.members.map((m) =>
          encode0x5BPlayerInGame({
            playerId: m.playerUnitId >>> 0,
            charClass: m.classId & 0xff,
            charName: m.charName,
            charLevel: m.level & 0xffff,
            partyId: m.partyId & 0xffff,
          }),
        )
      }
      const source = ev.source ?? 0
      const uId = (ev.playerId ?? ev.unitId ?? 1) >>> 0
      if (source === 0x5b || (ev.kind === 'roster' && ev.action === 'join')) {
        if (ev.nameSuffix || ev.nameSuffix2 || ev.relation !== undefined || ev.rosterWord44 !== undefined) {
          const s1 = ev.nameSuffix ?? ''
          const s2 = ev.nameSuffix2 ?? ''
          const totalLen = Math.max(36, 34 + s1.length + 1 + s2.length + 1)
          const w = new ByteWriter(totalLen)
          w.u8(0x5b)
          w.u16LE(totalLen)
          w.u32LE(uId)
          w.u8((ev.charClass ?? 0) & 0xff)
          w.fixedString(ev.charName ?? 'Hero', 16)
          w.u16LE((ev.charLevel ?? 1) & 0xffff)
          w.u16LE((ev.partyId ?? 0xffff) & 0xffff)
          w.u16LE(0)
          w.u16LE((ev.relation ?? 0) & 0xffff)
          w.u16LE((ev.rosterWord44 ?? 0) & 0xffff)
          w.cstring(s1)
          w.cstring(s2)
          return [w.toUint8Array()]
        }
        return [
          encode0x5BPlayerInGame({
            playerId: uId,
            charClass: (ev.charClass ?? 0) & 0xff,
            charName: ev.charName ?? 'Hero',
            charLevel: (ev.charLevel ?? 1) & 0xffff,
            partyId: (ev.partyId ?? 0xffff) & 0xffff,
          }),
        ]
      }
      if (source === 0x5c || (ev.kind === 'roster' && ev.action === 'leave')) {
        return [encode0x5CPlayerLeftGame(uId)]
      }
      if (source === 0x65 || ev.killCount !== undefined) {
        const w = new ByteWriter(7)
        w.u8(0x65)
        w.u32LE(uId)
        w.i16LE(ev.killCount ?? 0)
        return [w.toUint8Array()]
      }
      if (source === 0x66 || (ev.kind === 'memberState' && ev.areaId === undefined)) {
        const w = new ByteWriter(7)
        w.u8(0x66)
        w.u32LE(uId)
        w.u16LE((ev.lifePct ?? 100) & 0xffff)
        return [w.toUint8Array()]
      }
      if (source === 0x75 || (ev.kind === 'roster' && ev.action === undefined)) {
        const relWord = (ev.relation ?? 0) & 0xffff
        const inPartyWord = ev.inParty !== undefined ? (ev.inParty ? 1 : 0) : (((ev.relation ?? 0) >>> 16) & 0xffff)
        return [
          encode0x75PlayerPartyInfo({
            unitId: uId,
            partyId: (ev.partyId ?? 0xffff) & 0xffff,
            charLevel: (ev.charLevel ?? 1) & 0xffff,
            relationship: relWord,
            inYourParty: inPartyWord,
          }),
        ]
      }
      if (source === 0x8b || (ev.kind === 'relation' && ev.otherId === undefined)) {
        return [encode0x8BPartyInvite(uId, (ev.relation ?? 0) & 0xff)]
      }
      if (source === 0x8c || (ev.kind === 'relation' && ev.otherId !== undefined)) {
        return [encode0x8CPlayerRelation(uId, (ev.otherId ?? 0) >>> 0, (ev.relation ?? 0) & 0xffff)]
      }
      if (source === 0x8d || (ev.kind === 'roster' && ev.action === 'update')) {
        return [encode0x8DAssignPlayerToParty(uId, (ev.partyId ?? 0xffff) & 0xffff)]
      }
      if (source === 0x7f || ev.kind === 'memberState') {
        return [
          encode0x7FPartyMemberPulse({
            isPlayer: ev.isPlayer === false ? 0 : 1,
            lifePercent: (ev.lifePct ?? 100) & 0xffff,
            unitId: uId,
            areaId: (ev.areaId ?? 1) & 0xffff,
          }),
        ]
      }
      if (source === 0x90 || ev.kind === 'memberPos') {
        return [encode0x90MapPartyPulse(uId, ev.at?.x ?? 0, ev.at?.y ?? 0)]
      }
      return []
    }

    case 'Trade': {
      if (ev.action === 0x78 || ev.partnerName !== undefined || ev.partnerId !== undefined) {
        const w = new ByteWriter(21)
        w.u8(0x78)
        w.fixedString(ev.partnerName ?? '', 16)
        w.u32LE((ev.partnerId ?? 0) >>> 0)
        return [w.toUint8Array()]
      }
      if ((ev.action & 0xff00) === 0x7900 || ev.gold !== undefined) {
        const w = new ByteWriter(6)
        w.u8(0x79)
        w.u8(ev.action & 0xff)
        w.u32LE((ev.gold ?? 0) >>> 0)
        return [w.toUint8Array()]
      }
      return [new Uint8Array([0x77, ev.action & 0xff])]
    }

    case 'Chat': {
      const codec = resolveTextCodec('gbk')
      if (ev.kind === 'event') {
        const out = new Uint8Array(40)
        const dv = new DataView(out.buffer)
        out[0] = 0x5a
        out[1] = (ev.eventType ?? 0) & 0xff
        out[2] = (ev.color ?? 0) & 0xff
        dv.setUint32(3, (ev.arg ?? 0) >>> 0, true)
        out[7] = (ev.subType ?? 0) & 0xff
        const n1 = codec.encode(ev.name1 ?? ev.from ?? '')
        const n2 = codec.encode(ev.name2 ?? '')
        out.set(n1.subarray(0, 15), 8)
        out.set(n2.subarray(0, 15), 24)
        return [out]
      }
      const chatType =
        ev.eventType ??
        (ev.kind === 'overhead'
          ? 0x05
          : ev.kind === 'whisper'
            ? 0x02
            : ev.kind === 'system'
              ? 0x04
              : 0x01)
      const uType = ev.unit ? toWireUnitType(ev.unit.unitType, 0) : 0
      const uId = (ev.unit?.id ?? 0) >>> 0
      const fromBytes = codec.encode(ev.from ?? ev.speaker ?? '').subarray(0, 15)
      const textBytes = codec.encode(ev.text ?? '').subarray(0, 255)
      const out = new Uint8Array(10 + fromBytes.byteLength + 1 + textBytes.byteLength + 1)
      const dv = new DataView(out.buffer)
      out[0] = 0x26
      out[1] = chatType & 0xff
      out[2] = (ev.locale ?? 0) & 0xff
      out[3] = uType & 0xff
      dv.setUint32(4, uId, true)
      out[8] = (ev.color ?? 0) & 0xff
      out[9] = (ev.subType ?? 0) & 0xff
      out.set(fromBytes, 10)
      out[10 + fromBytes.byteLength] = 0
      out.set(textBytes, 10 + fromBytes.byteLength + 1)
      out[out.byteLength - 1] = 0
      return [out]
    }

    case 'PlaySound': {
      const uType = ev.unit ? toWireUnitType(ev.unit.unitType, 0) : 0
      const uId = (ev.unit?.id ?? 1) >>> 0
      const w = new ByteWriter(8)
      w.u8(0x2c)
      w.u8(uType & 0xff)
      w.u32LE(uId)
      w.u16LE(ev.sound & 0xffff)
      return [w.toUint8Array()]
    }

    case 'Merc': {
      if (ev.kind === 'hireList') {
        if (ev.nameId === undefined && ev.value === undefined) {
          return [new Uint8Array([0x4f])]
        }
        const w = new ByteWriter(7)
        w.u8(0x4e)
        w.u16LE((ev.nameId ?? 0) & 0xffff)
        w.u32LE((ev.value ?? ev.seed ?? 0) >>> 0)
        return [w.toUint8Array()]
      }
      if (ev.kind === 'assign') {
        if (ev.isSummonAction || ev.summonAction !== undefined) {
          const w = new ByteWriter(13)
          w.u8(0x7a)
          w.u8((ev.summonAction ?? ev.stat ?? 1) & 0xff)
          w.u8((ev.petType ?? ev.value ?? 0) & 0xff)
          w.u16LE((ev.classId ?? 0) & 0xffff)
          w.u32LE((ev.ownerId ?? 0) >>> 0)
          w.u32LE((ev.mercId ?? 0) >>> 0)
          return [w.toUint8Array()]
        }
        const w = new ByteWriter(20)
        w.u8(0x81)
        w.u8(7)
        w.u16LE((ev.classId ?? 0) & 0xffff)
        w.u32LE((ev.ownerId ?? 0) >>> 0)
        w.u32LE((ev.mercId ?? 0) >>> 0)
        w.u32LE((ev.seed ?? ev.value ?? 0) >>> 0)
        w.u32LE((ev.nameId ?? 0) & 0xffff)
        return [w.toUint8Array()]
      }
      if (ev.kind === 'exp') {
        const val = (ev.value ?? 0) >>> 0
        if (val <= 0xff) {
          const w = new ByteWriter(7)
          w.u8(0xa1)
          w.u8((ev.stat ?? 13) & 0xff)
          w.u32LE((ev.mercId ?? 0) >>> 0)
          w.u8(val & 0xff)
          return [w.toUint8Array()]
        }
        const w = new ByteWriter(8)
        w.u8(0xa2)
        w.u8((ev.stat ?? 13) & 0xff)
        w.u32LE((ev.mercId ?? 0) >>> 0)
        w.u16LE(Math.min(0xffff, val) & 0xffff)
        return [w.toUint8Array()]
      }
      // kind === 'stat'
      if (ev.mercId === undefined && ev.nameId !== undefined) {
        const w = new ByteWriter(7)
        w.u8(0x9b)
        w.u16LE(ev.nameId & 0xffff)
        w.u16LE((ev.value ?? 0) & 0xffff)
        w.u16LE(0)
        return [w.toUint8Array()]
      }
      return [encodeMonsterAttrPacket(ev.mercId ?? 0, ev.stat ?? 6, ev.value ?? 0)]
    }

    case 'Portal': {
      const out: Uint8Array[] = []
      const localId = (ev.localId ?? ev.portalId ?? 0) >>> 0
      const hasOwnership =
        ev.ownerId !== undefined || ev.ownerName !== undefined || ev.remoteId !== undefined
      if (hasOwnership) {
        const w = new ByteWriter(29)
        w.u8(0x82)
        w.u32LE((ev.ownerId ?? 0) >>> 0)
        w.fixedString(ev.ownerName ?? '', 16)
        w.u32LE(localId)
        w.u32LE((ev.remoteId ?? localId) >>> 0)
        out.push(w.toUint8Array())
      }
      if (ev.flags !== undefined || !hasOwnership) {
        const destArea = (ev.destAreaId ?? ev.areaId ?? 0) & 0xff
        const w = new ByteWriter(7)
        w.u8(0x60)
        w.u8((ev.flags ?? 1) & 0xff)
        w.u8(destArea)
        w.u32LE(localId)
        out.push(w.toUint8Array())
      }
      return out
    }

    case 'Pong': {
      const out = new Uint8Array(33)
      const dv = new DataView(out.buffer)
      out[0] = 0x8f
      dv.setUint32(1, ev.tickCount >>> 0, true)
      return [out]
    }

    case 'Warden': {
      const payload = ev.payload.subarray(0, 0x1fd)
      const out = new Uint8Array(3 + payload.byteLength)
      const dv = new DataView(out.buffer)
      out[0] = 0xae
      dv.setUint16(1, payload.byteLength, true)
      out.set(payload, 3)
      return [out]
    }

    case 'SaveChunk': {
      const chunk = ev.chunk.subarray(0, 255)
      if (chunk.byteLength === 0) return []
      const out = new Uint8Array(7 + chunk.byteLength)
      const dv = new DataView(out.buffer)
      out[0] = 0xb3
      out[1] = chunk.byteLength & 0xff
      out[2] = ev.isFirst ? 0 : 1
      dv.setUint32(3, ev.totalSize >>> 0, true)
      out.set(chunk, 7)
      return [out]
    }

    case 'Opaque': {
      if (ev.raw instanceof Uint8Array && ev.raw.byteLength > 0) {
        try {
          if (resolveFramedS2cPacketSize(ev.raw) === ev.raw.byteLength) {
            return [ev.raw]
          }
        } catch {
          return []
        }
      }
      return []
    }

    default: {
      const _exhaustive: never = ev
      void _exhaustive
      return []
    }
  }
}

/**
 * Encodes a `ServerEvent` (including legacy alias names used by synthetic callers) into
 * 0 or more valid 1.13c S->C wire packets. Never emits dummy `[0x04]` (`LoadDone`) fallbacks.
 */
export function serverEventToS2cPackets(
  ev: ServerEvent | Record<string, any>,
  tables: ItemDataTables = getDefault113cItemDataTables(),
): readonly Uint8Array[] {
  if (!ev || typeof ev !== 'object') return []
  const raw = ev as Record<string, any>
  switch (raw.type) {
    case 'ActDataLoaded':
      return encodeTypedServerEventToS2cPackets(
        {
          type: 'LoadAct',
          act: Number(raw.act ?? 0),
          mapSeed: Number(raw.mapSeed ?? 0),
          areaId: Number(raw.townAreaId ?? raw.areaId ?? 1),
          objectSeed: Number(raw.unknown ?? raw.objectSeed ?? 0),
        },
        tables,
      )
    case 'EntitySpawn':
      return encodeTypedServerEventToS2cPackets(
        {
          type: 'UnitAssign',
          unit:
            raw.unit ??
            ({
              unitType: raw.unitType ?? 0,
              id: Number(raw.unitId ?? raw.id ?? 1),
              classId: Number(raw.classId ?? 0),
              name: raw.name,
              x: Number(raw.x ?? 0),
              y: Number(raw.y ?? 0),
              mode: raw.mode,
              flags: raw.flags,
              lifePct: raw.lifePct,
            } as any),
        },
        tables,
      )
    case 'EntityRemove':
      return encodeTypedServerEventToS2cPackets(
        {
          type: 'UnitRemove',
          unitType: raw.unitType ?? 1,
          id: Number(raw.id ?? raw.unitId ?? 0),
        },
        tables,
      )
    case 'ChatMessage':
      return encodeTypedServerEventToS2cPackets(
        {
          type: 'Chat',
          kind: raw.kind ?? 'say',
          from: String(raw.speaker ?? raw.from ?? 'Server'),
          text: String(raw.text ?? ''),
          color: raw.color,
          locale: raw.locale,
          eventType: raw.eventType,
          subType: raw.subType,
          unit: raw.unit,
        },
        tables,
      )
    case 'SoundEvent':
      return encodeTypedServerEventToS2cPackets(
        {
          type: 'PlaySound',
          unit:
            raw.unit ??
            (raw.unitType !== undefined || raw.unitId !== undefined
              ? { unitType: raw.unitType ?? 0, id: Number(raw.unitId ?? 1) }
              : undefined),
          sound: Number(raw.sound ?? raw.soundId ?? 1),
        },
        tables,
      )
    case 'StatUpdate': {
      const unitRef =
        raw.unit ??
        (raw.unitType !== undefined && raw.unitId !== undefined
          ? { unitType: raw.unitType, id: Number(raw.unitId) }
          : undefined)
      return encodeTypedServerEventToS2cPackets(
        {
          type: 'StatSet',
          unit: unitRef,
          stat: Number(raw.stat ?? raw.statId ?? 0),
          value: Number(raw.value ?? 0),
          param: raw.param !== undefined ? Number(raw.param) : undefined,
          flag: raw.flag !== undefined ? Number(raw.flag) : undefined,
        },
        tables,
      )
    }
    case 'LifeManaUpdate':
    case 'LifeManaPot':
    case 'LifeManaPotUpdate':
      return encodeTypedServerEventToS2cPackets(
        {
          type: 'LifeMana',
          life: Number(raw.life ?? raw.hp ?? 0),
          mana: Number(raw.mana ?? raw.mp ?? 0),
          stamina: Number(raw.stamina ?? 0),
          lifeRegen: raw.lifeRegen !== undefined ? Number(raw.lifeRegen) : undefined,
          manaRegen: raw.manaRegen !== undefined ? Number(raw.manaRegen) : undefined,
          at:
            raw.at ??
            (raw.x !== undefined || raw.y !== undefined
              ? { x: Number(raw.x ?? 0), y: Number(raw.y ?? 0) }
              : undefined),
          vx: raw.vx !== undefined ? Number(raw.vx) : undefined,
          vy: raw.vy !== undefined ? Number(raw.vy) : undefined,
        },
        tables,
      )
    case 'Party': {
      // Legacy `kind: 'hp_pulse' | 'map_pulse'` aliases
      if (raw.kind === 'hp_pulse') {
        return [
          encode0x7FPartyMemberPulse({
            isPlayer: Number(raw.isPlayer ?? 1) & 0xff,
            lifePercent: Number(raw.lifePct ?? raw.lifePercent ?? 100) & 0xffff,
            unitId: Number(raw.unitId ?? raw.playerId ?? 1) >>> 0,
            areaId: Number(raw.areaId ?? 1) & 0xffff,
          }),
        ]
      }
      if (raw.kind === 'map_pulse') {
        return [
          encode0x90MapPartyPulse(
            Number(raw.unitId ?? raw.playerId ?? 1) >>> 0,
            Number(raw.x ?? raw.at?.x ?? 0),
            Number(raw.y ?? raw.at?.y ?? 0),
          ),
        ]
      }
      return encodeTypedServerEventToS2cPackets(ev as ServerEvent, tables)
    }
    default:
      return encodeTypedServerEventToS2cPackets(ev as ServerEvent, tables)
  }
}
