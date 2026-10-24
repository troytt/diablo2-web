/**
 * Diablo II 1.13c v96 `.d2s` Character Save Binary Reader (`src/server/save/d2s-reader.ts`).
 * Zero DOM or Node dependencies.
 */

import { RAW_ARMOR, RAW_MISC, RAW_WEAPONS } from '../../common/data/canonical-drop-data.ts'
import { RAW_ITEM_STAT_COST } from '../../common/data/canonical-vendor-data.ts'
import {
  D2S_MAGIC,
  D2S_VERSION,
  decodeGfStatSection,
  verifyD2sChecksum,
  type D2sAttributes,
  type D2sAttributesInput,
  type D2sDecodedAttributes,
} from '../../common/formats/d2s.ts'
import { parseTable, type D2Table } from '../../common/world/acts.ts'
import {
  decodeItemBitstreamWithLength,
  type CharClassId,
  type CharSummary,
  type ItemBaseMeta,
  type ItemData,
  type ItemDataTables,
  type ItemPacketHeaderMeta,
  type ItemStatCostMeta,
} from '../../netproto/index.ts'

function getCell(table: D2Table, row: readonly string[], colName: string): string {
  const exact = table.header.indexOf(colName)
  if (exact !== -1) return (row[exact] ?? '').trim()
  const lower = colName.toLowerCase()
  const foundIdx = table.header.findIndex((h) => h.trim().toLowerCase() === lower)
  if (foundIdx !== -1) return (row[foundIdx] ?? '').trim()
  return ''
}

function getNum(table: D2Table, row: readonly string[], colName: string, fallback = 0): number {
  const text = getCell(table, row, colName)
  if (!text) return fallback
  const n = Number(text)
  return Number.isFinite(n) ? n : fallback
}

function getBool(table: D2Table, row: readonly string[], colName: string): boolean {
  const text = getCell(table, row, colName)
  return text === '1' || text.toLowerCase() === 'true'
}

function parseBaseTable(
  rawTsv: string,
  kind: 'armor' | 'weapon' | 'misc',
  enc: TextEncoder,
): Map<string, ItemBaseMeta> {
  const table = parseTable(enc.encode(rawTsv))
  const map = new Map<string, ItemBaseMeta>()
  for (const row of table.rows) {
    const name = getCell(table, row, 'name')
    if (!name || name.toLowerCase() === 'expansion') continue
    const code = getCell(table, row, 'code')
    if (!code) continue

    const stackable = getBool(table, row, 'stackable')
    const nodurability = kind === 'misc' ? true : getBool(table, row, 'nodurability')
    const durability = getNum(table, row, 'durability', 0)
    const hasDurability = kind !== 'misc' && !nodurability && durability > 0
    const invWidth = Math.max(1, getNum(table, row, 'invwidth', 1))
    const invHeight = Math.max(1, getNum(table, row, 'invheight', 1))
    const minDefense = kind === 'armor' ? getNum(table, row, 'minac', 0) : 0
    const type = getCell(table, row, 'type')
    const isTome = type === 'book' || code === 'tbk' || code === 'ibk'
    const isBodyPart = type === 'body'
    const isGold = code === 'gld'
    const quest = getNum(table, row, 'quest', 0) > 0
    const questDiffCheck = getBool(table, row, 'questdiffcheck')

    const meta: ItemBaseMeta = {
      code,
      kind,
      stackable,
      hasDurability,
      nodurability,
      invWidth,
      invHeight,
      minDefense,
      isTome,
      isBodyPart,
      isGold,
      quest,
      questDiffCheck,
    }
    map.set(code, meta)
    const padded = code.padEnd(4, ' ').slice(0, 4)
    if (!map.has(padded)) {
      map.set(padded, meta)
    }
  }
  return map
}

let cachedServerItemDataTables: ItemDataTables | null = null

export function getServerItemDataTables(): ItemDataTables {
  if (cachedServerItemDataTables) return cachedServerItemDataTables
  const enc = new TextEncoder()
  const statTable = parseTable(enc.encode(RAW_ITEM_STAT_COST))
  const itemStatCost = new Map<number, ItemStatCostMeta>()

  for (const row of statTable.rows) {
    const stat = getCell(statTable, row, 'Stat')
    if (!stat || stat.toLowerCase() === 'expansion') continue
    const id = getNum(statTable, row, 'ID', -1)
    if (id < 0) continue

    const saveBits = getNum(statTable, row, 'Save Bits', 0)
    const saveAdd = getNum(statTable, row, 'Save Add', 0)
    const saveParamBits = getNum(statTable, row, 'Save Param Bits', 0)
    const sendBits = getNum(statTable, row, 'Send Bits', 0)
    const sendParamBits = getNum(statTable, row, 'Send Param Bits', 0)
    const signed = getBool(statTable, row, 'Signed')
    const valShift = getNum(statTable, row, 'ValShift', 0)
    const encode = getNum(statTable, row, 'Encode', 0)

    itemStatCost.set(id, {
      id,
      name: stat,
      saveBits,
      saveAdd,
      saveParamBits,
      sendBits,
      sendParamBits,
      signed,
      valShift,
      encode,
    })
  }

  const armor = parseBaseTable(RAW_ARMOR, 'armor', enc)
  const weapons = parseBaseTable(RAW_WEAPONS, 'weapon', enc)
  const misc = parseBaseTable(RAW_MISC, 'misc', enc)

  const lookupBase = (code: string): ItemBaseMeta | undefined => {
    const trimmed = code.trim()
    return (
      armor.get(trimmed) ??
      weapons.get(trimmed) ??
      misc.get(trimmed) ??
      armor.get(code) ??
      weapons.get(code) ??
      misc.get(code)
    )
  }
  const lookupStat = (statId: number): ItemStatCostMeta | undefined => itemStatCost.get(statId)

  cachedServerItemDataTables = {
    itemStatCost,
    armor,
    weapons,
    misc,
    getStatMeta: lookupStat,
    getStatCost: lookupStat,
    getItemBaseMeta: lookupBase,
    getItemMeta: lookupBase,
  }
  return cachedServerItemDataTables
}

export type D2sSavedItem = ItemData
export type D2sItemInput =
  | ItemData
  | (Partial<Omit<ItemData, 'quality' | 'location' | 'equippedSlot' | 'panel'>> & {
      readonly code: string
      readonly quality?: number | undefined
      readonly location?: number | undefined
      readonly equippedSlot?: number | undefined
      readonly panel?: number | undefined
    })

export interface D2sMercData {
  readonly dead?: boolean | number | undefined
  readonly flags?: number | undefined
  readonly isDead?: boolean | undefined
  readonly seed?: number | undefined
  readonly guid?: number | undefined
  readonly nameId: number
  readonly typeId: number
  readonly experience: number
  readonly items?: readonly D2sItemInput[] | undefined
}

export interface D2sDecodedMercData extends D2sMercData {
  readonly dead: boolean
  readonly flags: number
  readonly isDead: boolean
  readonly seed: number
  readonly guid: number
  readonly nameId: number
  readonly typeId: number
  readonly experience: number
  readonly items: readonly D2sSavedItem[]
}

export type D2sMercenaryHeader = D2sMercData

const CLASS_ID_TO_CODE: readonly ('ama' | 'sor' | 'nec' | 'pal' | 'bar' | 'dru' | 'ass')[] = [
  'ama',
  'sor',
  'nec',
  'pal',
  'bar',
  'dru',
  'ass',
] as const

/**
 * Canonical `PROJECT.md § Interface Contracts #2` character data shape.
 */
export interface D2sCharacterData {
  readonly version?: number | undefined
  readonly name: string
  readonly charClass: number
  readonly classId?: CharClassId | number | undefined
  readonly classCode?: 'ama' | 'sor' | 'nec' | 'pal' | 'bar' | 'dru' | 'ass' | undefined
  readonly level: number
  readonly statusFlags: number
  readonly isExpansion?: boolean | undefined
  readonly isHardcore?: boolean | undefined
  readonly isDead?: boolean | undefined
  readonly progression: number
  readonly activeWeapon: 0 | 1
  readonly timestampSec: number
  readonly createdTimestamp?: number | undefined
  readonly lastPlayedTimestamp?: number | undefined
  readonly timestamp?: number | undefined
  readonly hotkeys: readonly number[]
  readonly assignedSkills?: readonly number[] | Uint32Array | undefined
  readonly leftRightSkills: readonly [number, number, number, number]
  readonly leftSkill?: number | undefined
  readonly rightSkill?: number | undefined
  readonly altLeftSkill?: number | undefined
  readonly altRightSkill?: number | undefined
  readonly appearance: Uint8Array
  readonly menuAppearance?: Uint8Array | undefined
  readonly difficultyTowns: readonly [number, number, number]
  readonly difficultyLocation?: Uint8Array | undefined
  readonly activeDifficulty: 0 | 1 | 2
  readonly difficulty?: 0 | 1 | 2 | undefined
  readonly activeAct: 0 | 1 | 2 | 3 | 4
  readonly act?: 0 | 1 | 2 | 3 | 4 | undefined
  readonly mapSeed: number
  readonly merc: {
    readonly dead: boolean
    readonly flags?: number | undefined
    readonly isDead?: boolean | undefined
    readonly seed: number
    readonly guid?: number | undefined
    readonly nameId: number
    readonly typeId: number
    readonly experience: number
    readonly items?: readonly D2sSavedItem[] | undefined
  }
  readonly mercenary?: D2sMercData | null | undefined
  readonly mercItems?: readonly D2sSavedItem[] | undefined
  readonly quests: readonly [Uint16Array, Uint16Array, Uint16Array]
  readonly questsRaw?: Uint8Array | undefined
  readonly waypoints: readonly [Uint8Array, Uint8Array, Uint8Array]
  readonly waypointsRaw?: Uint8Array | undefined
  readonly npcIntros: Uint8Array
  readonly npcIntro?: Uint8Array | undefined
  readonly attributes: D2sAttributes
  readonly skillLevels: Uint8Array
  readonly skills?: Uint8Array | undefined
  readonly items: readonly D2sSavedItem[]
  readonly corpseItems?: readonly D2sSavedItem[] | undefined
  readonly ironGolem?: D2sSavedItem | null | undefined
  readonly ironGolemItem?: D2sSavedItem | null | undefined
}

/**
 * Flexible input interface accepted by `writeD2sSave113c` / `writeD2s` / `writeD2sSave`.
 */
export interface D2sCharacterSave {
  readonly version?: number | undefined
  readonly name: string
  readonly classId?: CharClassId | number | undefined
  readonly charClass?: CharClassId | number | undefined
  readonly classCode?: 'ama' | 'sor' | 'nec' | 'pal' | 'bar' | 'dru' | 'ass' | undefined
  readonly level: number
  readonly statusFlags?: number | undefined
  readonly isExpansion?: boolean | undefined
  readonly isHardcore?: boolean | undefined
  readonly isDead?: boolean | undefined
  readonly progression?: number | undefined
  readonly activeWeapon?: 0 | 1 | number | undefined
  readonly timestampSec?: number | undefined
  readonly createdTimestamp?: number | undefined
  readonly lastPlayedTimestamp?: number | undefined
  readonly timestamp?: number | undefined
  readonly hotkeys?: readonly number[] | Uint32Array | undefined
  readonly assignedSkills?: readonly number[] | Uint32Array | undefined
  readonly leftRightSkills?: readonly [number, number, number, number] | readonly number[] | undefined
  readonly leftSkill?: number | undefined
  readonly rightSkill?: number | undefined
  readonly altLeftSkill?: number | undefined
  readonly altRightSkill?: number | undefined
  readonly appearance?: Uint8Array | undefined
  readonly menuAppearance?: Uint8Array | undefined
  readonly difficultyTowns?: readonly [number, number, number] | readonly number[] | undefined
  readonly difficultyLocation?: Uint8Array | undefined
  readonly activeDifficulty?: 0 | 1 | 2 | undefined
  readonly difficulty?: 0 | 1 | 2 | undefined
  readonly activeAct?: 0 | 1 | 2 | 3 | 4 | undefined
  readonly act?: 0 | 1 | 2 | 3 | 4 | undefined
  readonly mapSeed: number
  readonly merc?: D2sMercData | null | undefined
  readonly mercenary?: D2sMercData | null | undefined
  readonly mercItems?: readonly D2sItemInput[] | undefined
  readonly quests?: readonly [Uint16Array, Uint16Array, Uint16Array] | Uint8Array | undefined
  readonly questsRaw?: Uint8Array | undefined
  readonly waypoints?: readonly [Uint8Array, Uint8Array, Uint8Array] | Uint8Array | undefined
  readonly waypointsRaw?: Uint8Array | undefined
  readonly npcIntro?: Uint8Array | undefined
  readonly npcIntros?: Uint8Array | undefined
  readonly attributes: D2sAttributesInput
  readonly skills?: Uint8Array | undefined
  readonly skillLevels?: Uint8Array | undefined
  readonly items: readonly D2sItemInput[]
  readonly corpseItems?: readonly D2sItemInput[] | undefined
  readonly ironGolem?: D2sItemInput | null | undefined
  readonly ironGolemItem?: D2sItemInput | null | undefined
}

/**
 * Complete decoded `.d2s` structure returned by `readD2sSave113c` / `readD2s` / `readD2sSave`,
 * satisfying both `D2sCharacterData` (`PROJECT.md § Interface Contracts #2`) and legacy `D2sCharacterSave` fields.
 */
export interface D2sDecodedCharacterSave extends D2sCharacterData {
  readonly version: number
  readonly classId: CharClassId
  readonly classCode: 'ama' | 'sor' | 'nec' | 'pal' | 'bar' | 'dru' | 'ass'
  readonly isExpansion: boolean
  readonly isHardcore: boolean
  readonly isDead: boolean
  readonly createdTimestamp: number
  readonly lastPlayedTimestamp: number
  readonly timestamp: number
  readonly assignedSkills: readonly number[]
  readonly leftSkill: number
  readonly rightSkill: number
  readonly altLeftSkill: number
  readonly altRightSkill: number
  readonly menuAppearance: Uint8Array
  readonly difficultyLocation: Uint8Array
  readonly difficulty: 0 | 1 | 2
  readonly act: 0 | 1 | 2 | 3 | 4
  readonly merc: D2sDecodedMercData
  readonly mercenary: D2sDecodedMercData
  readonly mercItems: readonly D2sSavedItem[]
  readonly questsRaw: Uint8Array
  readonly waypointsRaw: Uint8Array
  readonly npcIntro: Uint8Array
  readonly attributes: D2sDecodedAttributes
  readonly skills: Uint8Array
  readonly corpseItems: readonly D2sSavedItem[]
  readonly ironGolem: D2sSavedItem | null
  readonly ironGolemItem: D2sSavedItem | null
}

const DEFAULT_SAVE_ITEM_HEADER: ItemPacketHeaderMeta = {
  opcode: 0x9c,
  action: 0x04,
  category: 0,
  itemId: 1,
}

export function readItemListSection(
  buf: Uint8Array,
  offset: number,
  tables: ItemDataTables,
): {
  readonly items: ItemData[]
  readonly nextOffset: number
} {
  if (offset + 4 > buf.byteLength || buf[offset] !== 0x4a || buf[offset + 1] !== 0x4d) {
    throw new Error(`Invalid .d2s "JM" item list header at offset 0x${offset.toString(16)}`)
  }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const topLevelCount = view.getUint16(offset + 2, true)
  let cursor = offset + 4
  const items: ItemData[] = []
  let nextItemId = 1

  for (let i = 0; i < topLevelCount; i++) {
    const header: ItemPacketHeaderMeta = {
      ...DEFAULT_SAVE_ITEM_HEADER,
      itemId: nextItemId++,
    }
    const { item, byteLength } = decodeItemBitstreamWithLength(buf.subarray(cursor), header, tables, {
      saveFormat: true,
      expectJmHeader: true,
    })
    cursor += byteLength

    const childCount = item.socketedChildCount ?? 0
    const children: ItemData[] = []
    for (let c = 0; c < childCount; c++) {
      const childHeader: ItemPacketHeaderMeta = {
        ...DEFAULT_SAVE_ITEM_HEADER,
        itemId: nextItemId++,
      }
      const childRes = decodeItemBitstreamWithLength(buf.subarray(cursor), childHeader, tables, {
        saveFormat: true,
        expectJmHeader: true,
      })
      cursor += childRes.byteLength
      children.push(childRes.item)
    }

    const hostWithChildren: ItemData =
      children.length > 0 ? { ...item, socketedItems: children } : item
    items.push(hostWithChildren)
  }

  return { items, nextOffset: cursor }
}

/**
 * Parses a 1.13c v96 `.d2s` binary save buffer into `D2sCharacterSave`.
 */
export function readD2sSave113c(
  buf: Uint8Array,
  tables: ItemDataTables = getServerItemDataTables(),
): D2sDecodedCharacterSave {
  if (buf.byteLength < 0x2fd) {
    throw new Error(`.d2s file too short: ${buf.byteLength} bytes (expected >= 765)`)
  }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)

  const magic = view.getUint32(0x00, true) >>> 0
  if (magic !== D2S_MAGIC) {
    throw new Error(`Invalid .d2s magic 0x${magic.toString(16)} (expected 0xaa55aa55)`)
  }
  const version = view.getUint32(0x04, true) >>> 0
  if (version !== D2S_VERSION) {
    throw new Error(`Unsupported .d2s version ${version} (expected ${D2S_VERSION})`)
  }
  const fileSize = view.getUint32(0x08, true) >>> 0
  if (fileSize !== buf.byteLength) {
    throw new Error(`.d2s file size mismatch: header=${fileSize}, actual=${buf.byteLength}`)
  }
  if (!verifyD2sChecksum(buf)) {
    const stored = view.getUint32(0x0c, true) >>> 0
    throw new Error(`.d2s checksum mismatch (stored=0x${stored.toString(16)})`)
  }

  const activeWeapon: 0 | 1 = view.getUint32(0x10, true) !== 0 ? 1 : 0

  let name = ''
  for (let i = 0; i < 16; i++) {
    const ch = buf[0x14 + i]!
    if (ch === 0) break
    name += String.fromCharCode(ch)
  }

  const statusFlags = buf[0x24]!
  const isHardcore = (statusFlags & 0x04) !== 0
  const isDead = (statusFlags & 0x08) !== 0
  const isExpansion = (statusFlags & 0x20) !== 0
  const progression = buf[0x25]!
  const classId = (buf[0x28]! & 0xff) as CharClassId
  const level = buf[0x2b]!
  const createdTimestamp = view.getUint32(0x2c, true) >>> 0
  const lastPlayedTimestamp = view.getUint32(0x30, true) >>> 0

  const hotkeys: number[] = []
  for (let i = 0; i < 16; i++) {
    hotkeys.push(view.getUint32(0x38 + i * 4, true) >>> 0)
  }

  const leftSkill = view.getUint32(0x78, true) >>> 0
  const rightSkill = view.getUint32(0x7c, true) >>> 0
  const altLeftSkill = view.getUint32(0x80, true) >>> 0
  const altRightSkill = view.getUint32(0x84, true) >>> 0

  const appearance = buf.slice(0x88, 0xa8)
  const difficultyLocation = buf.slice(0xa8, 0xab)
  const difficultyTowns: readonly [number, number, number] = [
    difficultyLocation[0]!,
    difficultyLocation[1]!,
    difficultyLocation[2]!,
  ]

  let activeDifficulty: 0 | 1 | 2 = 0
  let activeAct: 0 | 1 | 2 | 3 | 4 = 0
  for (let d = 0; d < 3; d++) {
    const b = difficultyLocation[d]!
    if ((b & 0x80) !== 0) {
      activeDifficulty = d as 0 | 1 | 2
      activeAct = Math.min(4, b & 0x07) as 0 | 1 | 2 | 3 | 4
      break
    }
  }

  const mapSeed = view.getUint32(0xab, true) >>> 0

  const mercDead = view.getUint16(0xb1, true)
  const mercSeed = view.getUint32(0xb3, true) >>> 0
  const mercNameId = view.getUint16(0xb7, true)
  const mercTypeId = view.getUint16(0xb9, true)
  const mercExp = view.getUint32(0xbb, true) >>> 0

  const questsRaw = buf.slice(0x14f, 0x14f + 298)
  if (
    questsRaw[0] !== 0x57 ||
    questsRaw[1] !== 0x6f ||
    questsRaw[2] !== 0x6f ||
    questsRaw[3] !== 0x21
  ) {
    throw new Error('Invalid .d2s "Woo!" quest header at 0x14F')
  }
  const quests: readonly [Uint16Array, Uint16Array, Uint16Array] = [
    new Uint16Array(48),
    new Uint16Array(48),
    new Uint16Array(48),
  ]
  for (let d = 0; d < 3; d++) {
    const base = 0x14f + 10 + d * 96
    const target = quests[d]!
    for (let q = 0; q < 48; q++) {
      target[q] = view.getUint16(base + q * 2, true)
    }
  }

  const waypointsRaw = buf.slice(0x279, 0x279 + 80)
  if (waypointsRaw[0] !== 0x57 || waypointsRaw[1] !== 0x53) {
    throw new Error('Invalid .d2s "WS" waypoint header at 0x279')
  }
  const waypoints: readonly [Uint8Array, Uint8Array, Uint8Array] = [
    waypointsRaw.slice(8, 32),
    waypointsRaw.slice(32, 56),
    waypointsRaw.slice(56, 80),
  ]

  const npcIntro = buf.slice(0x2c9, 0x2c9 + 52)

  const gfRes = decodeGfStatSection(buf, 0x2fd)
  let cursor = gfRes.nextOffset

  if (cursor + 32 > buf.byteLength || buf[cursor] !== 0x69 || buf[cursor + 1] !== 0x66) {
    throw new Error(`Invalid .d2s "if" skills header at offset 0x${cursor.toString(16)}`)
  }
  const skills = buf.slice(cursor + 2, cursor + 32)
  cursor += 32

  const playerItemsRes = readItemListSection(buf, cursor, tables)
  cursor = playerItemsRes.nextOffset

  // Corpse section: "JM" + u16LE corpseCount (0 or 1)
  if (cursor + 4 > buf.byteLength || buf[cursor] !== 0x4a || buf[cursor + 1] !== 0x4d) {
    throw new Error(`Invalid .d2s corpse "JM" header at offset 0x${cursor.toString(16)}`)
  }
  const corpseCount = view.getUint16(cursor + 2, true)
  cursor += 4
  const corpseItems: ItemData[] = []
  for (let c = 0; c < corpseCount; c++) {
    if (cursor + 12 > buf.byteLength) {
      throw new Error('Truncated .d2s corpse header')
    }
    cursor += 12
    const corpseListRes = readItemListSection(buf, cursor, tables)
    corpseItems.push(...corpseListRes.items)
    cursor = corpseListRes.nextOffset
  }

  // Expansion sections: "jf" mercenary items and "kf" Iron Golem
  let mercItems: ItemData[] = []
  let ironGolem: ItemData | null = null

  if (cursor + 2 <= buf.byteLength && buf[cursor] === 0x6a && buf[cursor] + 1 > 0 && buf[cursor + 1] === 0x66) {
    cursor += 2
    if (mercSeed !== 0 && cursor + 4 <= buf.byteLength && buf[cursor] === 0x4a && buf[cursor + 1] === 0x4d) {
      const mercListRes = readItemListSection(buf, cursor, tables)
      mercItems = mercListRes.items
      cursor = mercListRes.nextOffset
    }
  }

  if (cursor + 3 <= buf.byteLength && buf[cursor] === 0x6b && buf[cursor + 1] === 0x66) {
    const hasGolem = buf[cursor + 2]!
    cursor += 3
    if (hasGolem !== 0) {
      const golemRes = decodeItemBitstreamWithLength(
        buf.subarray(cursor),
        DEFAULT_SAVE_ITEM_HEADER,
        tables,
        {
          saveFormat: true,
          expectJmHeader: true,
        },
      )
      cursor += golemRes.byteLength
      const golemChildren: ItemData[] = []
      const childCount = golemRes.item.socketedChildCount ?? 0
      for (let c = 0; c < childCount; c++) {
        const childRes = decodeItemBitstreamWithLength(
          buf.subarray(cursor),
          DEFAULT_SAVE_ITEM_HEADER,
          tables,
          {
            saveFormat: true,
            expectJmHeader: true,
          },
        )
        cursor += childRes.byteLength
        golemChildren.push(childRes.item)
      }
      ironGolem =
        golemChildren.length > 0
          ? { ...golemRes.item, socketedItems: golemChildren }
          : golemRes.item
    }
  }

  const mercObj: D2sDecodedMercData = {
    dead: mercDead !== 0,
    flags: mercDead,
    isDead: mercDead !== 0,
    seed: mercSeed,
    guid: mercSeed,
    nameId: mercNameId,
    typeId: mercTypeId,
    experience: mercExp,
    items: mercItems,
  }

  const timestampSec = lastPlayedTimestamp || createdTimestamp

  return {
    version,
    name,
    classId,
    charClass: classId,
    classCode: CLASS_ID_TO_CODE[classId] ?? 'ama',
    level,
    statusFlags,
    isExpansion,
    isHardcore,
    isDead,
    progression,
    activeWeapon,
    timestampSec,
    createdTimestamp,
    lastPlayedTimestamp,
    timestamp: timestampSec,
    hotkeys,
    assignedSkills: hotkeys,
    leftRightSkills: [leftSkill, rightSkill, altLeftSkill, altRightSkill] as const,
    leftSkill,
    rightSkill,
    altLeftSkill,
    altRightSkill,
    appearance,
    menuAppearance: appearance,
    difficultyTowns,
    difficultyLocation,
    activeDifficulty,
    difficulty: activeDifficulty,
    activeAct,
    act: activeAct,
    mapSeed,
    merc: mercObj,
    mercenary: mercObj,
    mercItems,
    quests,
    questsRaw,
    waypoints,
    waypointsRaw,
    npcIntro,
    npcIntros: npcIntro,
    attributes: gfRes.attributes,
    skills,
    skillLevels: skills,
    items: playerItemsRes.items,
    corpseItems,
    ironGolem,
    ironGolemItem: ironGolem,
  }
}

export const readD2s = readD2sSave113c
export const readD2sSave = readD2sSave113c

export function extractCharSummaryFromD2s(
  source: Uint8Array | D2sCharacterData | D2sCharacterSave,
  tables: ItemDataTables = getServerItemDataTables(),
): CharSummary {
  const parsed = source instanceof Uint8Array ? readD2sSave113c(source, tables) : source
  const classNum = Number(parsed.classId ?? parsed.charClass ?? 0) & 0xff
  const charClass = (classNum >= 0 && classNum <= 6 ? classNum : 0) as CharClassId
  const statusFlags =
    parsed.statusFlags ??
    ((parsed.isExpansion === false ? 0x00 : 0x20) |
      (parsed.isHardcore ? 0x04 : 0x00) |
      (parsed.isDead ? 0x08 : 0x00))
  const hardcore = parsed.isHardcore ?? (statusFlags & 0x04) !== 0
  const dead = parsed.isDead ?? (statusFlags & 0x08) !== 0
  const expansion = parsed.isExpansion ?? (statusFlags & 0x20) !== 0
  const ladder = (statusFlags & 0x40) !== 0
  const act = (parsed.activeAct ?? parsed.act ?? 0) & 0x07
  const difficulty = (parsed.activeDifficulty ?? parsed.difficulty ?? 0) as 0 | 1 | 2
  const equipmentGraphics = new Uint8Array(9)
  equipmentGraphics.fill(0xff)
  if (parsed.appearance && parsed.appearance.byteLength >= 9) {
    equipmentGraphics.set(parsed.appearance.subarray(0, 9), 0)
  } else if (parsed.menuAppearance && parsed.menuAppearance.byteLength >= 9) {
    equipmentGraphics.set(parsed.menuAppearance.subarray(0, 9), 0)
  }
  const rawStatString = new Uint8Array(33)
  rawStatString.fill(0xff)
  return {
    name: parsed.name,
    charClass,
    classId: charClass,
    level: Math.max(1, parsed.level ?? 1),
    hardcore,
    dead,
    expansion,
    ladder,
    act,
    difficulty,
    ...(parsed.progression !== undefined ? { progression: parsed.progression } : {}),
    expiresAt: 0,
    equipmentGraphics,
    rawStatString,
  }
}
