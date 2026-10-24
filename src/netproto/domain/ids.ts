/**
 * Protocol-neutral domain identifiers, coordinates, unit types, and item structures.
 * Zero DOM or Node dependencies.
 */

export type UnitTypeName = 'player' | 'monster' | 'object' | 'missile' | 'item' | 'tile'
export type UnitKind = UnitTypeName
export type UnitTypeId = 0 | 1 | 2 | 3 | 4 | 5
export type UnitType = UnitTypeName | UnitTypeId
export type SubTile = number
export type UnitId = number

export function asSubTile(v: number): SubTile {
  return v
}

export function asUnitId(v: number): UnitId {
  return v >>> 0
}

export const UNIT_TYPE_FROM_ID: Readonly<Record<number, UnitTypeName>> = {
  0: 'player',
  1: 'monster',
  2: 'object',
  3: 'missile',
  4: 'item',
  5: 'tile',
} as const

export const UNIT_TYPE_TO_ID: Readonly<Record<UnitTypeName, UnitTypeId>> = {
  player: 0,
  monster: 1,
  object: 2,
  missile: 3,
  item: 4,
  tile: 5,
} as const

export function unitTypeFromId(id: number | UnitType): UnitTypeName {
  if (typeof id === 'string') return id
  return UNIT_TYPE_FROM_ID[id] ?? 'object'
}

export function unitTypeToId(type: UnitType | number): UnitTypeId {
  if (typeof type === 'number') {
    return (type >= 0 && type <= 5 ? type : 0) as UnitTypeId
  }
  return UNIT_TYPE_TO_ID[type] ?? 1
}

export interface UnitRef {
  readonly unitType: UnitType
  readonly kind?: UnitType | undefined
  readonly id: number
}

export interface Pt {
  readonly x: number
  readonly y: number
}

export type Hand = 'left' | 'right'

export type CharClassId = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const CHAR_CLASS_NAMES: Readonly<Record<CharClassId, string>> = {
  0: 'Amazon',
  1: 'Sorceress',
  2: 'Necromancer',
  3: 'Paladin',
  4: 'Barbarian',
  5: 'Druid',
  6: 'Assassin',
} as const

export type ItemContainer =
  | 'ground'
  | 'inventory'
  | 'equipment'
  | 'belt'
  | 'stash'
  | 'cube'
  | 'cursor'
  | 'socket'
  | 'shop'
  | 'trade'
  | 'tradeSelf'
  | 'tradePartner'
  | 'merc'

export type ItemQualityLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
export type ItemQuality = ItemQualityLevel
export type ItemActionId = number

export interface ItemStat {
  readonly statId: number
  readonly param: number
  readonly value: number
}

/**
 * One item-specific set-bonus stat list (SetItems.txt `aprop1a..aprop5b`) as sent in the item
 * bitstream. `index` is the bit of the 5-bit set-list mask (0..4) that announced this list, i.e. the
 * list belongs to statlist state `STATE_ITEMSET(index + 1)` (D2MOO `D2Common/src/Items/Items.cpp`
 * item bitstream reader: `gnItemSetStates[i]` for mask bit `i`, flag `STATLIST_SET | 0x40`).
 * The decoder keeps lists sparse and in ascending `index` order; an announced list may be empty.
 */
export interface SetBonusStatList {
  readonly index: number
  readonly stats: readonly ItemStat[]
}

export interface ItemData {
  readonly id: number
  readonly itemId: number
  readonly opcode: 0x9c | 0x9d
  readonly action: number
  readonly category: number
  readonly ownerType?: UnitType | undefined
  readonly ownerId?: number | undefined
  readonly flags: number
  readonly rawFlags: number
  readonly version: number
  readonly location: number
  readonly container: ItemContainer
  readonly bodyLoc: number
  readonly equippedSlot: number
  readonly gridX: number
  readonly gridY: number
  readonly storePage: number
  readonly storagePage: number
  readonly worldX: number
  readonly worldY: number
  readonly x: number
  readonly y: number
  readonly code: string
  readonly rawCode: string
  readonly compact: boolean
  readonly simple: boolean
  readonly identified: boolean
  readonly socketed: boolean
  readonly ethereal: boolean
  readonly runeword: boolean
  readonly personalized: boolean
  readonly isEar: boolean
  readonly newItem: boolean
  readonly starterItem: boolean
  readonly broken: boolean
  readonly inSocket: boolean
  readonly equipped: boolean
  readonly isGambleMystery?: boolean | undefined
  readonly socketedChildCount: number
  readonly usedSockets: number
  readonly totalSockets: number
  readonly guid?: number | undefined
  readonly ilvl?: number | undefined
  readonly quality?: ItemQualityLevel | undefined
  readonly graphicIndex?: number | undefined
  readonly autoAffixId?: number | undefined
  readonly qualitySubtype?: number | undefined
  readonly bodyPartMonsterClass?: number | undefined
  readonly magicPrefixId?: number | undefined
  readonly magicSuffixId?: number | undefined
  readonly setItemId?: number | undefined
  readonly uniqueItemId?: number | undefined
  readonly rareName1?: number | undefined
  readonly rareName2?: number | undefined
  readonly rareAffixes?: readonly number[] | undefined
  readonly runewordData?: number | undefined
  readonly personalizedName?: string | undefined
  readonly earClass?: number | undefined
  readonly earLevel?: number | undefined
  readonly earName?: string | undefined
  readonly tomeData?: number | undefined
  readonly defense?: number | undefined
  readonly maxDurability?: number | undefined
  readonly curDurability?: number | undefined
  readonly durability?: number | undefined
  readonly quantity?: number | undefined
  readonly goldAmount?: number | undefined
  readonly invWidth: number
  readonly invHeight: number
  readonly stats: readonly ItemStat[]
  readonly setBonusStats: readonly SetBonusStatList[]
  readonly runewordStats: readonly ItemStat[]
  readonly socketedItems?: readonly ItemData[] | undefined
}

export interface ItemStatCostMeta {
  readonly id: number
  readonly name: string
  readonly saveBits: number
  readonly saveAdd: number
  readonly saveParamBits: number
  readonly sendBits: number
  readonly sendParamBits: number
  readonly signed: boolean
  readonly valShift: number
  readonly encode: number
}

export type ItemStatCostField = ItemStatCostMeta

export interface ItemBaseMeta {
  readonly code: string
  readonly kind: 'armor' | 'weapon' | 'misc'
  readonly stackable: boolean
  readonly hasDurability: boolean
  readonly nodurability: boolean
  readonly invWidth: number
  readonly invHeight: number
  readonly minDefense: number
  readonly isTome: boolean
  readonly isBodyPart?: boolean | undefined
  readonly isGold: boolean
  readonly quest?: boolean | undefined
  readonly questDiffCheck?: boolean | undefined
}

export type ItemBaseStatEntry = ItemBaseMeta

export interface ItemDataTables {
  readonly itemStatCost: ReadonlyMap<number, ItemStatCostMeta>
  readonly armor: ReadonlyMap<string, ItemBaseMeta>
  readonly weapons: ReadonlyMap<string, ItemBaseMeta>
  readonly misc: ReadonlyMap<string, ItemBaseMeta>
  getStatMeta(statId: number): ItemStatCostMeta | undefined
  getStatCost(statId: number): ItemStatCostMeta | undefined
  getItemBaseMeta(code: string): ItemBaseMeta | undefined
  getItemMeta(code: string): ItemBaseMeta | undefined
}

export interface UnitSnapshot {
  readonly unitType: UnitType
  readonly id: number
  readonly classId: number
  readonly name?: string | undefined
  readonly x: number
  readonly y: number
  readonly mode?: number | undefined
  readonly direction?: number | undefined
  readonly lifePct?: number | undefined
  readonly flags?: number | undefined
  readonly warpId?: number | undefined
  readonly objectState?: number | undefined
  readonly interactType?: number | undefined
  readonly isChampion?: boolean | undefined
  readonly isUnique?: boolean | undefined
  readonly isSuperUnique?: boolean | undefined
  readonly isMinion?: boolean | undefined
  readonly superUniqueId?: number | undefined
  readonly bossMods?: readonly number[] | undefined
  readonly monUMods?: readonly (number | string)[] | undefined
  readonly tempSummonExpireTick?: number | undefined
  readonly nameSeed?: number | undefined
  readonly compVariants?: readonly number[] | undefined
  readonly ownerType?: UnitType | undefined
  readonly ownerId?: number | undefined
  readonly states?: readonly number[] | undefined
  readonly hidden?: boolean | undefined
}

export interface SkillLevel {
  readonly skillId: number
  readonly skill?: number | undefined
  readonly level: number
  readonly baseLevel?: number | undefined
  readonly bonus?: number | undefined
}
