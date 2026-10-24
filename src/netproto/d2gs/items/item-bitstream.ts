import { BitReader } from '../../core/bit-reader.ts'
import { BitWriter } from '../../core/bit-writer.ts'
import { ProtocolError } from '../../core/errors.ts'
import { unitTypeToId, type ItemData, type ItemDataTables, type ItemQuality, type ItemStat, type SetBonusStatList, type UnitType } from '../../domain/ids.ts'
import {
  ITEM_FLAG_BROKEN,
  ITEM_FLAG_COMPACT,
  ITEM_FLAG_EQUIPPED,
  ITEM_FLAG_ETHEREAL,
  ITEM_FLAG_IDENTIFIED,
  ITEM_FLAG_INSOCKET,
  ITEM_FLAG_ISEAR,
  ITEM_FLAG_NEWITEM,
  ITEM_FLAG_PERSONALIZED,
  ITEM_FLAG_RUNEWORD,
  ITEM_FLAG_SIMPLE_EXTENDED,
  ITEM_FLAG_SOCKETED,
  ITEM_FLAG_STARTERITEM,
  resolveItemContainer,
} from './item-types.ts'

/**
 * 1.13c Misc.txt codes with `type === 'body'` (ITYPE_BODYPART = 40) and not `ITYPE_PLAYERBODYPART` (7).
 * D2Common.dll `0x6fd7a97c..0x6fd7a9a2` (decoder) / `0x6fd779b5..0x6fd779f2` (encoder) encodes
 * a 10-bit `dwFileIndex` (monster class hcIdx) on Normal-quality body parts.
 */
const BODY_PART_CODES = new Set([
  'hrt',
  'brz',
  'jaw',
  'eyz',
  'hrn',
  'tal',
  'flg',
  'fng',
  'qll',
  'sol',
  'scz',
  'spe',
])

export interface DecodeItemBitstreamOptions {
  /**
   * When `false` (default, D2GS `0x9C` / `0x9D` network packets):
   * - No 16-bit `"JM"` prefix
   * - No 32-bit `guid` in extended section (`D2Common.dll` `0x6fd7a793`: `if (bSaveFormat != 0)`)
   * - Affix/stat lists omitted when `!identified` (`D2Common.dll` `0x6fd7a933`, `0x6fd7b252`)
   * - No `hasRealmData` bit (`D2Common.dll` `0x6fd7ace3`)
   * When `true` (`.d2s` save format):
   * - Optional `"JM"` prefix if `expectJmHeader` is set
   * - 32-bit `guid`, `hasRealmData`, and affix/stat lists always present
   */
  readonly saveFormat?: boolean
  readonly expectJmHeader?: boolean
}

/**
 * Decodes a 1.13c D2GS `0x9C` (8-byte header) or `0x9D` (13-byte header) item packet
 * per `D2Client.dll` (`0x6fb5e080`, `0x6fb5e880`, `0x6fb335c0`) and `D2Common.dll`
 * (`D2Common.11105` @ `0x6fd72150`, `D2Common.11145` @ `0x6fd7c470`, `0x6fd7c0c0`, `0x6fd7a600`).
 */
export function decodeD2gsItemPacket(
  pkt: Uint8Array,
  tables: ItemDataTables,
  options?: DecodeItemBitstreamOptions,
): ItemData {
  if (pkt.length < 8) {
    throw new ProtocolError(`D2GS item packet too short: ${pkt.length} bytes`, pkt[0])
  }
  const opcode = pkt[0]!
  if (opcode !== 0x9c && opcode !== 0x9d) {
    throw new ProtocolError(`Invalid D2GS item packet opcode 0x${opcode.toString(16)}`, opcode)
  }
  const headerLen = opcode === 0x9c ? 8 : 13
  if (pkt.length < headerLen) {
    throw new ProtocolError(`D2GS 0x${opcode.toString(16)} packet shorter than ${headerLen}-byte header: ${pkt.length}`, opcode)
  }

  const action = pkt[1]!
  const packetSize = pkt[2]!
  if (packetSize !== pkt.length) {
    throw new ProtocolError(
      `D2GS 0x${opcode.toString(16)} packetSize mismatch: header=${packetSize}, actual=${pkt.length}`,
      opcode,
    )
  }
  const category = pkt[3]!
  const view = new DataView(pkt.buffer, pkt.byteOffset, pkt.byteLength)
  const itemId = view.getUint32(4, true)

  let ownerType: UnitType | undefined
  let ownerId: number | undefined
  if (opcode === 0x9d) {
    ownerType = pkt[8]! as UnitType
    ownerId = view.getUint32(9, true)
  }

  const bitstream = pkt.subarray(headerLen)
  return decodeItemBitstream(
    bitstream,
    {
      opcode,
      action,
      category,
      itemId,
      ...(ownerType !== undefined ? { ownerType } : {}),
      ...(ownerId !== undefined ? { ownerId } : {}),
    },
    tables,
    options,
  )
}

export interface ItemPacketHeaderMeta {
  readonly opcode: 0x9c | 0x9d
  readonly action: number
  readonly category: number
  readonly itemId: number
  readonly ownerType?: UnitType
  readonly ownerId?: number
}

export interface ItemBitstreamEncodeOptions extends DecodeItemBitstreamOptions {
  readonly includeJmHeader?: boolean | undefined
  readonly tables?: ItemDataTables | undefined
}

export interface DecodedItemBitstreamResult {
  readonly item: ItemData
  readonly bitLength: number
  readonly byteLength: number
}

const DEFAULT_SAVE_HEADER_META: ItemPacketHeaderMeta = {
  opcode: 0x9c,
  action: 0x04,
  category: 0,
  itemId: 1,
}

function isItemDataTablesArg(arg: unknown): arg is ItemDataTables {
  return (
    typeof arg === 'object' &&
    arg !== null &&
    ('armor' in arg || 'itemStatCost' in arg || 'getItemBaseMeta' in arg)
  )
}

export function decodeItemBitstream(
  bitstream: Uint8Array,
  headerOrTables: ItemPacketHeaderMeta | ItemDataTables,
  tablesOrOffset?: ItemDataTables | number,
  optionsOrVersion?: DecodeItemBitstreamOptions | number,
): ItemData {
  return decodeItemBitstreamWithLength(
    bitstream,
    headerOrTables as ItemPacketHeaderMeta,
    tablesOrOffset as ItemDataTables,
    optionsOrVersion as DecodeItemBitstreamOptions,
  ).item
}

export function decodeItemBitstreamWithLength(
  bitstream: Uint8Array,
  headerOrTables: ItemPacketHeaderMeta | ItemDataTables,
  tablesOrOffset?: ItemDataTables | number,
  optionsOrVersion?: DecodeItemBitstreamOptions | number,
): DecodedItemBitstreamResult {
  let targetBuf = bitstream
  let header: ItemPacketHeaderMeta
  let tables: ItemDataTables
  let options: DecodeItemBitstreamOptions | undefined

  if (isItemDataTablesArg(headerOrTables)) {
    tables = headerOrTables
    const byteOffset = typeof tablesOrOffset === 'number' ? tablesOrOffset : 0
    if (byteOffset > 0) {
      targetBuf = bitstream.subarray(byteOffset)
    }
    const hasJm =
      targetBuf.byteLength >= 2 && targetBuf[0] === 0x4a && targetBuf[1] === 0x4d
    header = DEFAULT_SAVE_HEADER_META
    options =
      typeof optionsOrVersion === 'object' && optionsOrVersion !== null
        ? optionsOrVersion
        : {
            saveFormat: hasJm || optionsOrVersion === 96,
            expectJmHeader: hasJm,
          }
  } else {
    header = headerOrTables
    tables = tablesOrOffset as ItemDataTables
    options = optionsOrVersion as DecodeItemBitstreamOptions | undefined
  }

  const reader = new BitReader(targetBuf)
  const item = decodeItemFromReader(reader, header, tables, options)
  const bitLength = reader.bitOffset
  return {
    item,
    bitLength,
    byteLength: (bitLength + 7) >>> 3,
  }
}

function decodeItemFromReader(
  reader: BitReader,
  header: ItemPacketHeaderMeta,
  tables: ItemDataTables,
  options?: DecodeItemBitstreamOptions,
): ItemData {
  const saveFormat = options?.saveFormat ?? false

  if (options?.expectJmHeader) {
    const jm = reader.readBits(16)
    if (jm !== 0x4d4a) {
      throw new ProtocolError(`Expected "JM" (0x4d4a) item header, got 0x${jm.toString(16)}`, header.opcode)
    }
  }

  // 1. 32-bit dwFlags (D2Common.dll @ 0x6fd7c4c3)
  const rawFlags = reader.readBits(32)
  const equipped = (rawFlags & ITEM_FLAG_EQUIPPED) !== 0
  const inSocket = (rawFlags & ITEM_FLAG_INSOCKET) !== 0
  const identified = (rawFlags & ITEM_FLAG_IDENTIFIED) !== 0
  const broken = (rawFlags & ITEM_FLAG_BROKEN) !== 0
  const socketed = (rawFlags & ITEM_FLAG_SOCKETED) !== 0
  const newItem = (rawFlags & ITEM_FLAG_NEWITEM) !== 0
  const isEar = (rawFlags & ITEM_FLAG_ISEAR) !== 0
  const starterItem = (rawFlags & ITEM_FLAG_STARTERITEM) !== 0
  const compact = (rawFlags & ITEM_FLAG_COMPACT) !== 0
  const ethereal = (rawFlags & ITEM_FLAG_ETHEREAL) !== 0
  const personalized = (rawFlags & ITEM_FLAG_PERSONALIZED) !== 0
  const simpleExtended = (rawFlags & ITEM_FLAG_SIMPLE_EXTENDED) !== 0
  const runeword = (rawFlags & ITEM_FLAG_RUNEWORD) !== 0

  // 2. 10-bit version (0x6fd7c0c1 / 0x6fd7a612)
  const version = reader.readBits(10)

  // 3. 3-bit mode / location (0x6fd7c10b / 0x6fd7a662)
  const location = reader.readBits(3)

  // 4. Position data (0x6fd7c119 / 0x6fd7a670)
  let worldX = 0
  let worldY = 0
  let bodyLoc = 0
  let gridX = 0
  let gridY = 0
  let storePage = 0
  if (location === 3 || location === 5) {
    worldX = reader.readBits(16)
    worldY = reader.readBits(16)
  } else {
    bodyLoc = reader.readBits(4)
    gridX = reader.readBits(4)
    gridY = reader.readBits(4)
    storePage = reader.readBits(3)
  }

  const container = resolveItemContainer(header.opcode, header.action, header.ownerType, location, storePage)

  // 5. Branch A: Compact / Simple Item (D2Common.dll @ 0x6fd7c0c0)
  if (compact) {
    let code = '    '
    let earClass: number | undefined
    let earLevel: number | undefined
    let earName: string | undefined
    let goldAmount: number | undefined
    const stats: ItemStat[] = []

    if (isEar) {
      code = 'ear '
      earClass = reader.readBits(3)
      earLevel = reader.readBits(7)
      earName = read7BitString(reader)
    } else {
      code = read4CharCode(reader)
      if (code === 'gld ') {
        const isBigPile = reader.readBit()
        goldAmount = reader.readBits(isBigPile ? 32 : 12)
        stats.push({ statId: 14, param: 0, value: goldAmount })
      }
      // D2Common.dll @ 0x6fd7c2d7: if version > 0x5c and item has quest && questDiffCheck
      if (version > 0x5c) {
        const baseItem = lookupBaseItem(code, tables)
        if (baseItem?.quest && baseItem?.questDiffCheck) {
          const stat356 = getStatField(tables, 356)
          if (stat356.saveBits > 0 && reader.remainingBits >= stat356.saveBits) {
            const rawDiff = reader.readBits(stat356.saveBits)
            const val = (rawDiff - stat356.saveAdd) << stat356.valShift
            stats.push({ statId: 356, param: 0, value: val })
          }
        }
      }
      if (saveFormat && version > 0x56 && reader.remainingBits >= 1) {
        const hasRealmData = reader.readBit()
        if (hasRealmData) {
          reader.readBits(32)
          reader.readBits(32)
          if (version > 0x5d) reader.readBits(32)
        }
      }
    }

    const baseMeta = lookupBaseItem(code, tables)
    return {
      id: header.itemId,
      itemId: header.itemId,
      opcode: header.opcode,
      action: header.action,
      category: header.category,
      ...(header.ownerType !== undefined ? { ownerType: header.ownerType } : {}),
      ...(header.ownerId !== undefined ? { ownerId: header.ownerId } : {}),
      flags: rawFlags,
      rawFlags,
      version,
      location,
      container,
      bodyLoc,
      equippedSlot: bodyLoc,
      gridX,
      gridY,
      storePage,
      storagePage: storePage,
      worldX,
      worldY,
      x: location === 3 || location === 5 ? worldX : gridX,
      y: location === 3 || location === 5 ? worldY : gridY,
      code: code.trimEnd(),
      rawCode: code,
      compact: true,
      simple: true,
      identified,
      socketed,
      ethereal,
      runeword,
      personalized,
      isEar,
      newItem,
      starterItem,
      broken,
      inSocket,
      equipped,
      socketedChildCount: 0,
      usedSockets: 0,
      totalSockets: 0,
      invWidth: baseMeta?.invWidth ?? 1,
      invHeight: baseMeta?.invHeight ?? 1,
      ...(earClass !== undefined ? { earClass } : {}),
      ...(earLevel !== undefined ? { earLevel } : {}),
      ...(earName !== undefined ? { earName } : {}),
      ...(goldAmount !== undefined ? { goldAmount } : {}),
      ...(code === 'tsc ' || code === 'isc ' ? { magicSuffixId: code === 'isc ' ? 1 : 0 } : {}),
      stats,
      setBonusStats: [],
      runewordStats: [],
    }
  }

  // 6. Branch B: Extended Item (D2Common.dll @ 0x6fd7a600)
  const rawCode = isEar ? 'ear ' : read4CharCode(reader)
  const code = rawCode.trimEnd()

  // D2Common.dll @ 0x6fd7a746: if simpleExtended (dwFlags & 0x02000000), stop right after itemCode
  if (simpleExtended) {
    const baseMeta = lookupBaseItem(code, tables)
    return {
      id: header.itemId,
      itemId: header.itemId,
      opcode: header.opcode,
      action: header.action,
      category: header.category,
      ...(header.ownerType !== undefined ? { ownerType: header.ownerType } : {}),
      ...(header.ownerId !== undefined ? { ownerId: header.ownerId } : {}),
      flags: rawFlags,
      rawFlags,
      version,
      location,
      container,
      bodyLoc,
      equippedSlot: bodyLoc,
      gridX,
      gridY,
      storePage,
      storagePage: storePage,
      worldX,
      worldY,
      x: location === 3 || location === 5 ? worldX : gridX,
      y: location === 3 || location === 5 ? worldY : gridY,
      code,
      rawCode,
      compact: false,
      simple: false,
      identified,
      socketed,
      ethereal,
      runeword,
      personalized,
      isEar,
      newItem,
      starterItem,
      broken,
      inSocket,
      equipped,
      isGambleMystery: true,
      socketedChildCount: 0,
      usedSockets: 0,
      totalSockets: 0,
      invWidth: baseMeta?.invWidth ?? 1,
      invHeight: baseMeta?.invHeight ?? 1,
      stats: [],
      setBonusStats: [],
      runewordStats: [],
    }
  }

  // 3-bit socketedChildCount (0x6fd7a784)
  const socketedChildCount = reader.readBits(3)

  // 32-bit guid ONLY if saveFormat != 0 (0x6fd7a793)
  let guid: number | undefined
  if (saveFormat) {
    guid = reader.readBits(32)
  }

  // 7-bit ilvl (0x6fd7a7b0) & 4-bit quality (0x6fd7a7da)
  const ilvl = Math.max(1, reader.readBits(7))
  const quality = reader.readBits(4) as ItemQuality

  // 1-bit hasGraphic (+ 3-bit graphicIndex if 1) (0x6fd7a7f0)
  const hasGraphic = reader.readBit() === 1
  const graphicIndex = hasGraphic ? reader.readBits(3) : undefined

  // 1-bit hasAutoAffix (+ 11-bit autoAffixId if 1) (0x6fd7a89b)
  const hasAutoAffix = reader.readBit() === 1
  const autoAffixId = hasAutoAffix ? reader.readBits(11) : undefined

  // Quality branch (0x6fd7a902 -> jump table 0x6fd7bf60)
  const hasIdData = saveFormat || identified
  const baseEntry = lookupBaseItem(code, tables) ?? lookupBaseItem(rawCode, tables)
  let qualitySubtype: number | undefined
  let bodyPartMonsterClass: number | undefined
  let magicPrefixId: number | undefined
  let magicSuffixId: number | undefined
  let setItemId: number | undefined
  let uniqueItemId: number | undefined
  let rareName1: number | undefined
  let rareName2: number | undefined
  let rareAffixes: number[] | undefined
  let tomeData: number | undefined

  switch (quality) {
    case 1:
    case 3:
      // Low Quality (1) or Superior (3): 3 bits (0x6fd7a913)
      qualitySubtype = reader.readBits(3)
      break
    case 2: {
      // Normal (2) (0x6fd7a927)
      if (code === 'cm1' || code === 'cm2' || code === 'cm3') {
        if (hasIdData) {
          const isPrefix = reader.readBit() === 1
          const affix = reader.readBits(11)
          if (isPrefix) magicPrefixId = affix
          else magicSuffixId = affix
        }
      }
      // Body parts (ITYPE_BODYPART=40 && !ITYPE_PLAYERBODYPART=7) (0x6fd7a97c..0x6fd7a9a2)
      if (baseEntry?.isBodyPart || BODY_PART_CODES.has(code)) {
        bodyPartMonsterClass = reader.readBits(10)
      }
      if (code === 'tbk' || code === 'ibk' || code === 'tsc' || code === 'isc') {
        tomeData = reader.readBits(5)
      }
      break
    }
    case 4:
      // Magic (4) (0x6fd7aae3): 11b prefix + 11b suffix if hasIdData
      if (hasIdData) {
        magicPrefixId = reader.readBits(11)
        magicSuffixId = reader.readBits(11)
      }
      break
    case 5:
      // Set (5) (0x6fd7ab66): 12b setItemId if hasIdData
      if (hasIdData) {
        setItemId = reader.readBits(12)
      }
      break
    case 6:
    case 8: {
      // Rare (6) or Crafted (8) (0x6fd7a9d5..0x6fd7aaa5)
      if (hasIdData) {
        rareName1 = reader.readBits(8)
        rareName2 = reader.readBits(8)
      }
      rareAffixes = []
      // 3 pairs of (prefix, suffix) = 6 slots (0x6fd7aa05..0x6fd7aa9f, unconditional)
      for (let i = 0; i < 6; i++) {
        const present = reader.readBit() === 1
        rareAffixes.push(present ? reader.readBits(11) : 0)
      }
      break
    }
    case 7:
      // Unique (7) (0x6fd7ab27): 12b uniqueItemId if hasIdData
      if (hasIdData) {
        uniqueItemId = reader.readBits(12)
      }
      break
    case 9:
      // Tempered (9) (0x6fd7aaaa): 8b + 8b if hasIdData
      if (hasIdData) {
        rareName1 = reader.readBits(8)
        rareName2 = reader.readBits(8)
      }
      break
    default:
      throw new ProtocolError(`Invalid 1.13c item quality=${quality} in packet 0x${header.opcode.toString(16)}`, header.opcode)
  }

  // Runeword header (16 bits if runeword flag bit 26 is set) (0x6fd7ac10)
  let runewordData: number | undefined
  if (runeword) {
    runewordData = reader.readBits(16)
  }

  // Ear vs Personalized Name (0x6fd7ac4c..0x6fd7acdf)
  let earClass: number | undefined
  let earLevel: number | undefined
  let earName: string | undefined
  let personalizedName: string | undefined
  if (isEar) {
    earClass = reader.readBits(3)
    earLevel = reader.readBits(7)
    earName = read7BitString(reader)
  } else if (personalized) {
    personalizedName = read7BitString(reader)
  }

  // Save-only realmData (0x6fd7acdf)
  if (saveFormat && version > 0x56) {
    const hasRealmData = reader.readBit() === 1
    if (hasRealmData) {
      reader.readBits(32)
      reader.readBits(32)
      if (version > 0x5d) reader.readBits(32)
    }
  }

  // Base item specific fields: Armor (0x6fd7ad3f), Weapon (0x6fd7ae6a), Gold (0x6fd7b1b0), Stackable (0x6fd7b1df), Socketed (0x6fd7b21a)
  const isArmor = tables.armor.has(code) || tables.armor.has(rawCode)
  const isWeapon = !isArmor && (tables.weapons.has(code) || tables.weapons.has(rawCode))

  let defense: number | undefined
  let maxDurability: number | undefined
  let curDurability: number | undefined
  let goldAmount: number | undefined
  let quantity: number | undefined
  let totalSockets = 0

  if (isArmor) {
    const stat31 = getStatField(tables, 31)
    defense = (reader.readBits(stat31.saveBits) - stat31.saveAdd) << stat31.valShift
    const stat73 = getStatField(tables, 73)
    maxDurability = (reader.readBits(stat73.saveBits) - stat73.saveAdd) << stat73.valShift
    if (maxDurability > 0) {
      const stat72 = getStatField(tables, 72)
      const durBits = version > 0x5f ? stat72.saveBits : 8
      curDurability = (reader.readBits(durBits) - stat72.saveAdd) << stat72.valShift
    }
  } else if (isWeapon) {
    const stat73 = getStatField(tables, 73)
    maxDurability = (reader.readBits(stat73.saveBits) - stat73.saveAdd) << stat73.valShift
    if (maxDurability > 0) {
      const stat72 = getStatField(tables, 72)
      const durBits = version > 0x5f ? stat72.saveBits : 8
      curDurability = (reader.readBits(durBits) - stat72.saveAdd) << stat72.valShift
    }
  } else if (rawCode === 'gld ') {
    const isBigPile = reader.readBit() === 1
    goldAmount = reader.readBits(isBigPile ? 32 : 12)
  }

  if (baseEntry?.stackable) {
    quantity = reader.readBits(version > 0x50 ? 9 : 8)
  }

  if (socketed) {
    const stat194 = getStatField(tables, 194)
    totalSockets = (reader.readBits(stat194.saveBits) - stat194.saveAdd) << stat194.valShift
  }

  // Stat lists (0x6fd7b252..0x6fd7bf1c): present ONLY if saveFormat || identified
  const stats: ItemStat[] = []
  const setBonusStats: SetBonusStatList[] = []
  const runewordStats: ItemStat[] = []

  if (hasIdData) {
    let setBonusMask = 0
    if (version > 0x54 && quality === 5) {
      setBonusMask = reader.readBits(5)
    }

    // Base stat list (listIdx == -1)
    readStatList(reader, tables, version, stats)

    // Set bonus stat lists: D2MOO `D2Common/src/Items/Items.cpp` item bitstream reader — for
    // counter 0..4 with bit `counter` set in the 5-bit `nSetItemMask`, one stat list is read into a
    // statlist with state `gnItemSetStates[counter]` (STATE_ITEMSET1..5) and flag
    // `STATLIST_SET | 0x40` (created disabled; SetItems.txt `add func` enables it later). Keep the
    // mask bit as `index` so the add-func gating can address list `index` exactly.
    if (version > 0x54 && quality === 5) {
      for (let i = 0; i < 5; i++) {
        if ((setBonusMask & (1 << i)) !== 0) {
          const bonusList: ItemStat[] = []
          readStatList(reader, tables, version, bonusList)
          setBonusStats.push({ index: i, stats: bonusList })
        }
      }
    }

    // Runeword stat list
    if (runeword) {
      readStatList(reader, tables, version, runewordStats)
    }
  }

  return {
    id: header.itemId,
    itemId: header.itemId,
    opcode: header.opcode,
    action: header.action,
    category: header.category,
    ...(header.ownerType !== undefined ? { ownerType: header.ownerType } : {}),
    ...(header.ownerId !== undefined ? { ownerId: header.ownerId } : {}),
    flags: rawFlags,
    rawFlags,
    version,
    location,
    container,
    bodyLoc,
    equippedSlot: bodyLoc,
    gridX,
    gridY,
    storePage,
    storagePage: storePage,
    worldX,
    worldY,
    x: location === 3 || location === 5 ? worldX : gridX,
    y: location === 3 || location === 5 ? worldY : gridY,
    code,
    rawCode,
    compact: false,
    simple: false,
    identified,
    socketed,
    ethereal,
    runeword,
    personalized,
    isEar,
    newItem,
    starterItem,
    broken,
    inSocket,
    equipped,
    socketedChildCount,
    usedSockets: socketedChildCount,
    totalSockets,
    invWidth: baseEntry?.invWidth ?? 1,
    invHeight: baseEntry?.invHeight ?? 1,
    ...(guid !== undefined ? { guid } : {}),
    ilvl,
    quality,
    ...(graphicIndex !== undefined ? { graphicIndex } : {}),
    ...(autoAffixId !== undefined ? { autoAffixId } : {}),
    ...(qualitySubtype !== undefined ? { qualitySubtype } : {}),
    ...(bodyPartMonsterClass !== undefined ? { bodyPartMonsterClass } : {}),
    ...(magicPrefixId !== undefined ? { magicPrefixId } : {}),
    ...(magicSuffixId !== undefined ? { magicSuffixId } : {}),
    ...(setItemId !== undefined ? { setItemId } : {}),
    ...(uniqueItemId !== undefined ? { uniqueItemId } : {}),
    ...(rareName1 !== undefined ? { rareName1 } : {}),
    ...(rareName2 !== undefined ? { rareName2 } : {}),
    ...(rareAffixes !== undefined ? { rareAffixes } : {}),
    ...(runewordData !== undefined ? { runewordData } : {}),
    ...(personalizedName !== undefined ? { personalizedName } : {}),
    ...(earClass !== undefined ? { earClass } : {}),
    ...(earLevel !== undefined ? { earLevel } : {}),
    ...(earName !== undefined ? { earName } : {}),
    ...(tomeData !== undefined ? { tomeData } : {}),
    ...(defense !== undefined ? { defense } : {}),
    ...(maxDurability !== undefined ? { maxDurability } : {}),
    ...(curDurability !== undefined ? { curDurability, durability: curDurability } : {}),
    ...(quantity !== undefined ? { quantity } : {}),
    ...(goldAmount !== undefined ? { goldAmount } : {}),
    stats,
    setBonusStats,
    runewordStats,
  }
}

function normalizeNumericLocation(loc: unknown): number {
  if (typeof loc === 'number') return loc
  if (typeof loc === 'string') {
    switch (loc.toLowerCase()) {
      case 'inventory':
      case 'stored':
      case 'stash':
      case 'cube':
        return 0
      case 'equipped':
      case 'equipment':
        return 1
      case 'belt':
        return 2
      case 'ground':
        return 3
      case 'cursor':
        return 4
      case 'socket':
      case 'socketed':
        return 6
    }
  }
  return 0
}

/**
 * Encodes an `ItemData` object into a 1.13c item bitstream (`0x9C`/`0x9D` payload or `.d2s` `"JM"` entry).
 */
export function encodeItemBitstream(
  item: ItemData,
  tablesOrOptions: ItemDataTables | (ItemBitstreamEncodeOptions & { readonly tables: ItemDataTables }),
  maybeOptions?: ItemBitstreamEncodeOptions,
): Uint8Array {
  let tables: ItemDataTables
  let options: ItemBitstreamEncodeOptions | undefined
  let defaultSaveMode = false

  if (isItemDataTablesArg(tablesOrOptions)) {
    tables = tablesOrOptions
    options = maybeOptions
  } else {
    tables = tablesOrOptions.tables
    options = tablesOrOptions
    defaultSaveMode = true
  }

  const saveFormat = options?.saveFormat ?? defaultSaveMode
  const writeJm =
    options?.expectJmHeader ?? options?.includeJmHeader ?? defaultSaveMode
  const bw = new BitWriter()

  if (writeJm) {
    bw.writeBits(0x4d4a, 16)
  }

  let rawFlags = (item.rawFlags ?? item.flags ?? 0) >>> 0
  if (item.equipped) rawFlags |= ITEM_FLAG_EQUIPPED
  if (item.inSocket) rawFlags |= ITEM_FLAG_INSOCKET
  if (item.identified) rawFlags |= ITEM_FLAG_IDENTIFIED
  if (item.broken) rawFlags |= ITEM_FLAG_BROKEN
  if (item.socketed) rawFlags |= ITEM_FLAG_SOCKETED
  if (item.newItem) rawFlags |= ITEM_FLAG_NEWITEM
  if (item.isEar || (item as unknown as { readonly ear?: boolean }).ear) rawFlags |= ITEM_FLAG_ISEAR
  if (item.starterItem) rawFlags |= ITEM_FLAG_STARTERITEM
  if (item.compact || item.simple) rawFlags |= ITEM_FLAG_COMPACT
  if (item.ethereal) rawFlags |= ITEM_FLAG_ETHEREAL
  if (item.personalized) rawFlags |= ITEM_FLAG_PERSONALIZED
  if (item.isGambleMystery) rawFlags |= ITEM_FLAG_SIMPLE_EXTENDED
  if (item.runeword) rawFlags |= ITEM_FLAG_RUNEWORD
  rawFlags >>>= 0

  const version = item.version ?? 100
  const location = normalizeNumericLocation(item.location ?? item.container)
  const isCompact = Boolean(item.compact || item.simple || (rawFlags & ITEM_FLAG_COMPACT) !== 0)
  const isEar = Boolean(item.isEar || (rawFlags & ITEM_FLAG_ISEAR) !== 0)
  const isIdentified = Boolean(item.identified || (rawFlags & ITEM_FLAG_IDENTIFIED) !== 0)
  const isSocketed = Boolean(item.socketed || (rawFlags & ITEM_FLAG_SOCKETED) !== 0)
  const isRuneword = Boolean(item.runeword || (rawFlags & ITEM_FLAG_RUNEWORD) !== 0)
  const isPersonalized = Boolean(item.personalized || (rawFlags & ITEM_FLAG_PERSONALIZED) !== 0)

  bw.writeBits(rawFlags, 32)
  bw.writeBits(version & 0x3ff, 10)
  bw.writeBits(location & 0x07, 3)

  if (location === 3 || location === 5) {
    bw.writeBits((item.worldX ?? item.x ?? 0) & 0xffff, 16)
    bw.writeBits((item.worldY ?? item.y ?? 0) & 0xffff, 16)
  } else {
    const storePage =
      item.storePage ??
      item.storagePage ??
      (item.container === 'stash'
        ? 5
        : item.container === 'cube'
          ? 4
          : item.container === 'trade'
            ? 2
            : item.container === 'inventory'
              ? 1
              : 0)
    bw.writeBits((item.bodyLoc ?? item.equippedSlot ?? 0) & 0x0f, 4)
    bw.writeBits((item.gridX ?? item.x ?? 0) & 0x0f, 4)
    bw.writeBits((item.gridY ?? item.y ?? 0) & 0x0f, 4)
    bw.writeBits(storePage & 0x07, 3)
  }

  const rawCode = (item.rawCode || item.code || '    ').padEnd(4, ' ').slice(0, 4)
  const code = (item.code || rawCode).trimEnd()

  if (isCompact) {
    if (isEar) {
      bw.writeBits((item.earClass ?? 0) & 0x07, 3)
      bw.writeBits((item.earLevel ?? 1) & 0x7f, 7)
      write7BitString(bw, item.earName ?? '')
    } else {
      write4CharCode(bw, rawCode)
      if (rawCode === 'gld ') {
        const amt = item.goldAmount ?? 0
        const isBig = amt >= 4096
        bw.writeBit(isBig ? 1 : 0)
        bw.writeBits(amt >>> 0, isBig ? 32 : 12)
      }
      if (version > 0x5c) {
        const baseItem = lookupBaseItem(code, tables)
        if (baseItem?.quest && baseItem?.questDiffCheck) {
          const stat356 = getStatField(tables, 356)
          const st = (item.stats ?? []).find((s) => s.statId === 356)
          const rawVal = ((st?.value ?? 0) >> stat356.valShift) + stat356.saveAdd
          bw.writeBits(rawVal, stat356.saveBits)
        }
      }
      if (saveFormat && version > 0x56) {
        bw.writeBit(0)
      }
    }
  } else {
    if (!isEar) {
      write4CharCode(bw, rawCode)
    }
    if ((rawFlags & ITEM_FLAG_SIMPLE_EXTENDED) === 0) {
      const socketedChildCount =
        item.socketedChildCount ?? item.usedSockets ?? item.socketedItems?.length ?? 0
      bw.writeBits(socketedChildCount & 0x07, 3)
      if (saveFormat) {
        bw.writeBits((item.guid ?? item.id ?? item.itemId ?? 0) >>> 0, 32)
      }
      bw.writeBits((item.ilvl ?? 1) & 0x7f, 7)
      const quality = item.quality ?? 2
      bw.writeBits(quality & 0x0f, 4)

      if (item.graphicIndex !== undefined) {
        bw.writeBit(1)
        bw.writeBits(item.graphicIndex & 0x07, 3)
      } else {
        bw.writeBit(0)
      }

      if (item.autoAffixId !== undefined) {
        bw.writeBit(1)
        bw.writeBits(item.autoAffixId & 0x7ff, 11)
      } else {
        bw.writeBit(0)
      }

      const baseEntry = lookupBaseItem(code, tables) ?? lookupBaseItem(rawCode, tables)
      const hasIdData = saveFormat || isIdentified
      switch (quality) {
        case 1:
        case 3:
          bw.writeBits((item.qualitySubtype ?? 0) & 0x07, 3)
          break
        case 2:
          if (code === 'cm1' || code === 'cm2' || code === 'cm3') {
            if (hasIdData) {
              if (item.magicPrefixId !== undefined) {
                bw.writeBit(1)
                bw.writeBits(item.magicPrefixId & 0x7ff, 11)
              } else {
                bw.writeBit(0)
                bw.writeBits((item.magicSuffixId ?? 0) & 0x7ff, 11)
              }
            }
          }
          if (baseEntry?.isBodyPart || BODY_PART_CODES.has(code)) {
            bw.writeBits((item.bodyPartMonsterClass ?? 0) & 0x3ff, 10)
          }
          if (code === 'tbk' || code === 'ibk' || code === 'tsc' || code === 'isc') {
            bw.writeBits((item.tomeData ?? 0) & 0x1f, 5)
          }
          break
        case 4:
          if (hasIdData) {
            bw.writeBits((item.magicPrefixId ?? 0) & 0x7ff, 11)
            bw.writeBits((item.magicSuffixId ?? 0) & 0x7ff, 11)
          }
          break
        case 5:
          if (hasIdData) {
            bw.writeBits((item.setItemId ?? 0) & 0xfff, 12)
          }
          break
        case 6:
        case 8: {
          if (hasIdData) {
            bw.writeBits((item.rareName1 ?? 0) & 0xff, 8)
            bw.writeBits((item.rareName2 ?? 0) & 0xff, 8)
          }
          // 6 affix slots are encoded unconditionally (0x6fd776e3..0x6fd777ac)
          const affixes = item.rareAffixes ?? [0, 0, 0, 0, 0, 0]
          for (let i = 0; i < 6; i++) {
            const a = affixes[i] ?? 0
            if (a > 0) {
              bw.writeBit(1)
              bw.writeBits(a & 0x7ff, 11)
            } else {
              bw.writeBit(0)
            }
          }
          break
        }
        case 7:
          if (hasIdData) {
            bw.writeBits((item.uniqueItemId ?? 0) & 0xfff, 12)
          }
          break
        case 9:
          if (hasIdData) {
            bw.writeBits((item.rareName1 ?? 0) & 0xff, 8)
            bw.writeBits((item.rareName2 ?? 0) & 0xff, 8)
          }
          break
      }

      if (isRuneword) {
        bw.writeBits((item.runewordData ?? 0) & 0xffff, 16)
      }

      if (isEar) {
        bw.writeBits((item.earClass ?? 0) & 0x07, 3)
        bw.writeBits((item.earLevel ?? 1) & 0x7f, 7)
        write7BitString(bw, item.earName ?? '')
      } else if (isPersonalized) {
        write7BitString(bw, item.personalizedName ?? '')
      }

      if (saveFormat && version > 0x56) {
        bw.writeBit(0)
      }

      const isArmor = tables.armor.has(code) || tables.armor.has(rawCode)
      const isWeapon = !isArmor && (tables.weapons.has(code) || tables.weapons.has(rawCode))

      if (isArmor) {
        const stat31 = getStatField(tables, 31)
        const rawDef = (((item.defense ?? 0) >> stat31.valShift) + stat31.saveAdd) >>> 0
        bw.writeBits(rawDef, stat31.saveBits)
        const stat73 = getStatField(tables, 73)
        const maxDur = item.maxDurability ?? 0
        bw.writeBits(((maxDur >> stat73.valShift) + stat73.saveAdd) >>> 0, stat73.saveBits)
        if (maxDur > 0) {
          const stat72 = getStatField(tables, 72)
          const durBits = version > 0x5f ? stat72.saveBits : 8
          const curDur = item.curDurability ?? item.durability ?? maxDur
          bw.writeBits(((curDur >> stat72.valShift) + stat72.saveAdd) >>> 0, durBits)
        }
      } else if (isWeapon) {
        const stat73 = getStatField(tables, 73)
        const maxDur = item.maxDurability ?? 0
        bw.writeBits(((maxDur >> stat73.valShift) + stat73.saveAdd) >>> 0, stat73.saveBits)
        if (maxDur > 0) {
          const stat72 = getStatField(tables, 72)
          const durBits = version > 0x5f ? stat72.saveBits : 8
          const curDur = item.curDurability ?? item.durability ?? maxDur
          bw.writeBits(((curDur >> stat72.valShift) + stat72.saveAdd) >>> 0, durBits)
        }
      } else if (rawCode === 'gld ') {
        const amt = item.goldAmount ?? 0
        const isBig = amt >= 4096
        bw.writeBit(isBig ? 1 : 0)
        bw.writeBits(amt >>> 0, isBig ? 32 : 12)
      }

      if (baseEntry?.stackable) {
        bw.writeBits((item.quantity ?? 1) >>> 0, version > 0x50 ? 9 : 8)
      }

      if (isSocketed) {
        const stat194 = getStatField(tables, 194)
        const totalSockets =
          item.totalSockets ??
          (item as unknown as { readonly socketCount?: number }).socketCount ??
          item.socketedItems?.length ??
          0
        bw.writeBits((((totalSockets) >> stat194.valShift) + stat194.saveAdd) >>> 0, stat194.saveBits)
      }

      if (hasIdData) {
        // D2MOO `D2Common/src/Items/Items.cpp` item bitstream writer: mask bit `i` is set when the
        // item owns a statlist with state STATE_ITEMSET(i + 1) (flag `0x2040` or `0x40`, i.e. even
        // when it is disabled or empty); the lists are then written in ascending state order.
        const setLists =
          version > 0x54 && quality === 5
            ? orderSetBonusListsForEncode(item.setBonusStats ?? [], item.opcode ?? 0x9c)
            : []
        if (version > 0x54 && quality === 5) {
          let mask = 0
          for (const list of setLists) {
            mask |= 1 << list.index
          }
          bw.writeBits(mask, 5)
        }

        writeStatList(bw, tables, item.stats ?? [])

        for (const list of setLists) {
          writeStatList(bw, tables, list.stats)
        }

        if (isRuneword) {
          writeStatList(bw, tables, item.runewordStats ?? [])
        }
      }
    }
  }

  return bw.toUint8Array()
}

/**
 * Encodes an `ItemData` object back into a complete `0x9C` (8B header) or `0x9D` (13B header) packet
 * for deterministic round-trip unit testing.
 */
export function encodeD2gsItemPacket(
  item: ItemData,
  tables: ItemDataTables,
  options?: ItemBitstreamEncodeOptions,
): Uint8Array {
  const bitstreamBytes = encodeItemBitstream(item, tables, options)
  const opcode = item.opcode ?? 0x9c
  const headerLen = opcode === 0x9c ? 8 : 13
  const totalLen = headerLen + bitstreamBytes.length
  const out = new Uint8Array(totalLen)
  const view = new DataView(out.buffer)
  out[0] = opcode
  out[1] = (item.action ?? 0) & 0xff
  out[2] = totalLen & 0xff
  out[3] = (item.category ?? 0) & 0xff
  view.setUint32(4, (item.itemId ?? item.id ?? 0) >>> 0, true)
  if (opcode === 0x9d) {
    out[8] = (item.ownerType !== undefined ? unitTypeToId(item.ownerType) : 0) & 0xff
    view.setUint32(9, (item.ownerId ?? 0) >>> 0, true)
  }
  out.set(bitstreamBytes, headerLen)
  return out
}

/**
 * Validates and orders set-bonus lists for the encoder: each list must carry a distinct integer
 * mask index 0..4 (STATE_ITEMSET1..5). Throws instead of guessing so a malformed item can never be
 * re-encoded with a shifted mask.
 */
function orderSetBonusListsForEncode(
  lists: readonly SetBonusStatList[],
  opcode: number,
): readonly SetBonusStatList[] {
  const seen = new Set<number>()
  for (const list of lists) {
    if (!Number.isInteger(list.index) || list.index < 0 || list.index > 4) {
      throw new ProtocolError(`Invalid set bonus list index=${list.index} (expected 0..4)`, opcode)
    }
    if (seen.has(list.index)) {
      throw new ProtocolError(`Duplicate set bonus list index=${list.index}`, opcode)
    }
    seen.add(list.index)
  }
  return [...lists].sort((a, b) => a.index - b.index)
}

function readStatList(
  reader: BitReader,
  tables: ItemDataTables,
  version: number,
  out: ItemStat[],
): void {
  while (true) {
    const statId = reader.readBits(9)
    if (statId === 0x1ff) {
      break
    }
    if (statId < 0 || statId >= 511) {
      throw new ProtocolError(`Invalid item statId=${statId} in item bitstream`, 0x9c)
    }

    // Paired / chained stats in D2Common.dll @ 0x6fd7b560..0x6fd7b8c9
    switch (statId) {
      case 17: // item_maxdamage_percent -> 17, 18
        out.push(readSingleStat(reader, tables, 17, version))
        out.push(readSingleStat(reader, tables, 18, version))
        break
      case 48: // firemindam -> 48, 49
        out.push(readSingleStat(reader, tables, 48, version))
        out.push(readSingleStat(reader, tables, 49, version))
        break
      case 50: // lightmindam -> 50, 51
        out.push(readSingleStat(reader, tables, 50, version))
        out.push(readSingleStat(reader, tables, 51, version))
        break
      case 52: // magicmindam -> 52, 53
        out.push(readSingleStat(reader, tables, 52, version))
        out.push(readSingleStat(reader, tables, 53, version))
        break
      case 54: // coldmindam -> 54, 55, 56
        out.push(readSingleStat(reader, tables, 54, version))
        out.push(readSingleStat(reader, tables, 55, version))
        out.push(readSingleStat(reader, tables, 56, version))
        break
      case 57: // poisonmindam -> 57, 58, 59
        out.push(readSingleStat(reader, tables, 57, version))
        out.push(readSingleStat(reader, tables, 58, version))
        out.push(readSingleStat(reader, tables, 59, version))
        break
      default:
        out.push(readSingleStat(reader, tables, statId, version))
        break
    }
  }
}

function readSingleStat(
  reader: BitReader,
  tables: ItemDataTables,
  statId: number,
  _version: number,
): ItemStat {
  const field = getStatField(tables, statId)
  // In D2Common.dll @ 0x6fd7b560..0x6fd7b8c9, chained stats 17,18,48..59 only read saveBits (their saveParamBits is 0).
  // In D2Common.dll @ 0x6fd79e62, default stats read saveParamBits (if > 0) then saveBits.
  const param = field.saveParamBits > 0 ? reader.readBits(field.saveParamBits) : 0
  const raw = field.saveBits > 0 ? reader.readBits(field.saveBits) : 0
  const value = (raw - field.saveAdd) << field.valShift
  return { statId, param, value }
}

function writeStatList(bw: BitWriter, tables: ItemDataTables, stats: readonly ItemStat[]): void {
  let i = 0
  while (i < stats.length) {
    const st = stats[i]!
    bw.writeBits(st.statId & 0x1ff, 9)
    writeSingleStatValue(bw, tables, st)
    // If st.statId is one of the chained stats (17, 48, 50, 52, 54, 57), write the chained followers without a 9-bit statId
    if (st.statId === 17 && i + 1 < stats.length && stats[i + 1]!.statId === 18) {
      writeSingleStatValue(bw, tables, stats[i + 1]!)
      i += 2
      continue
    }
    if (st.statId === 48 && i + 1 < stats.length && stats[i + 1]!.statId === 49) {
      writeSingleStatValue(bw, tables, stats[i + 1]!)
      i += 2
      continue
    }
    if (st.statId === 50 && i + 1 < stats.length && stats[i + 1]!.statId === 51) {
      writeSingleStatValue(bw, tables, stats[i + 1]!)
      i += 2
      continue
    }
    if (st.statId === 52 && i + 1 < stats.length && stats[i + 1]!.statId === 53) {
      writeSingleStatValue(bw, tables, stats[i + 1]!)
      i += 2
      continue
    }
    if (
      st.statId === 54 &&
      i + 2 < stats.length &&
      stats[i + 1]!.statId === 55 &&
      stats[i + 2]!.statId === 56
    ) {
      writeSingleStatValue(bw, tables, stats[i + 1]!)
      writeSingleStatValue(bw, tables, stats[i + 2]!)
      i += 3
      continue
    }
    if (
      st.statId === 57 &&
      i + 2 < stats.length &&
      stats[i + 1]!.statId === 58 &&
      stats[i + 2]!.statId === 59
    ) {
      writeSingleStatValue(bw, tables, stats[i + 1]!)
      writeSingleStatValue(bw, tables, stats[i + 2]!)
      i += 3
      continue
    }
    i++
  }
  bw.writeBits(0x1ff, 9)
}

function writeSingleStatValue(bw: BitWriter, tables: ItemDataTables, st: ItemStat): void {
  const field = getStatField(tables, st.statId)
  if (field.saveParamBits > 0) {
    bw.writeBits(st.param >>> 0, field.saveParamBits)
  }
  if (field.saveBits > 0) {
    const raw = ((st.value >> field.valShift) + field.saveAdd) >>> 0
    bw.writeBits(raw, field.saveBits)
  }
}

function getStatField(tables: ItemDataTables, statId: number) {
  const entry = tables.itemStatCost.get(statId)
  if (!entry) {
    throw new ProtocolError(`Missing ItemStatCost entry for statId=${statId}`, 0x9c)
  }
  return entry
}

function lookupBaseItem(code: string, tables: ItemDataTables) {
  const trimmed = code.trimEnd()
  return (
    tables.armor.get(trimmed) ??
    tables.weapons.get(trimmed) ??
    tables.misc.get(trimmed) ??
    tables.armor.get(code) ??
    tables.weapons.get(code) ??
    tables.misc.get(code)
  )
}

function read4CharCode(reader: BitReader): string {
  const c0 = reader.readBits(8)
  const c1 = reader.readBits(8)
  const c2 = reader.readBits(8)
  const c3 = reader.readBits(8)
  return String.fromCharCode(c0, c1, c2, c3)
}

function write4CharCode(bw: BitWriter, code: string): void {
  const padded = code.padEnd(4, ' ').slice(0, 4)
  for (let i = 0; i < 4; i++) {
    bw.writeBits(padded.charCodeAt(i) & 0xff, 8)
  }
}

function read7BitString(reader: BitReader): string {
  const chars: number[] = []
  for (let i = 0; i < 16; i++) {
    const ch = reader.readBits(7)
    if (ch === 0) break
    chars.push(ch)
  }
  return String.fromCharCode(...chars)
}

function write7BitString(bw: BitWriter, str: string): void {
  const s = str.slice(0, 15)
  for (let i = 0; i < s.length; i++) {
    bw.writeBits(s.charCodeAt(i) & 0x7f, 7)
  }
  bw.writeBits(0, 7)
}
