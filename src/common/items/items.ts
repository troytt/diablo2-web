/**
 * Items: bases, affixes, inventory and drops.
 *
 * This is the M3 skeleton, and its shape follows how Diablo II actually stores
 * items: an item is a *base* (`weapons.txt` / `armor.txt` / `misc.txt` row) with
 * an optional prefix and suffix from `MagicPrefix.txt` / `MagicSuffix.txt`, whose
 * modifiers name stats from `ItemStatCost.txt`. Nothing is hardcoded here — a
 * sword is a table row with a size and a damage value, and "Cruel" is a table row
 * with a level requirement, a list of eligible item types and a modifier range.
 *
 * Two modelling decisions are worth stating because they are what make the system
 * testable:
 *
 * - **Randomness is injected.** Affix rolls take an {@link Rng}, so a drop is a
 *   pure function of its seed and can be replayed exactly in a test.
 * - **The inventory is a grid of occupied cells, not a list.** Diablo II items
 *   have width and height, cannot overlap, and can be rotated only in the sense
 *   that their shape is fixed — so placement is a real constraint that has to be
 *   modelled to make "inventory full" mean anything.
 *
 * Simplifications, called out rather than hidden: affixes are chosen uniformly
 * among eligible ones instead of by the game's level-weighted tables, item
 * requirements (strength/dexterity/level) are stored but not enforced, and
 * durability, sockets and quality tiers (normal/exceptional/elite) are not
 * modelled yet.
 */
import { Rng } from '../rng/d2-rng.ts'
import { numberCell, textCell } from './tables.ts'
import type { DataTable } from './tables.ts'

/** What a base is, broadly. */
export type ItemKind = 'weapon' | 'armor' | 'misc'

/** One item base, read from a table row. */
export interface ItemBase {
  /** Table id (for example `swd` for a short sword). */
  readonly id: string
  /** Display name. */
  readonly name: string
  /** Broad kind. */
  readonly kind: ItemKind
  /** Inventory width in cells. */
  readonly invWidth: number
  /** Inventory height in cells. */
  readonly invHeight: number
  /** How many of this base fit in one cell (1 for most things). */
  readonly maxStack: number
  /** Base gold value. */
  readonly value: number
  /** Weapon damage, when it is a weapon. */
  readonly damage: number
  /** Armor rating, when it is armor. */
  readonly defense: number
  /** Tags affixes match against (the item's type list). */
  readonly tags: readonly string[]
  /** Minimum level before it may drop. */
  readonly level: number
  /** Authentic drop SFX sound linker from dropsound column (e.g. 'item_gold', 'item_armor', 'item_weapon'). */
  readonly dropsound?: string | undefined
  /** Authentic drop animation frame at which dropsound triggers (from dropsfxframe column). */
  readonly dropsfxframe?: number | undefined
  /** Base gold cost from cost column. */
  readonly cost?: number | undefined
  /** Gamble cost from gamble cost column. */
  readonly gambleCost?: number | undefined
  /** Primary item type code from type column. */
  readonly type?: string | undefined
  /** Secondary item type code from type2 column. */
  readonly type2?: string | undefined
  /** Normal tier item code. */
  readonly normcode?: string | undefined
  /** Exceptional (uber) tier item code. */
  readonly ubercode?: string | undefined
  /** Elite (ultra) tier item code. */
  readonly ultracode?: string | undefined
  /** Upgrade item code in Nightmare vendor stores ('xxx' if none). */
  readonly nightmareUpgrade?: string | undefined
  /** Upgrade item code in Hell vendor stores ('xxx' if none). */
  readonly hellUpgrade?: string | undefined
  /** Whether this item is a permanent store item (PermStoreItem === 1). */
  readonly permStoreItem?: boolean | undefined
  /** Whether shift+right-click multi-buy is supported (multibuy === 1). */
  readonly multibuy?: boolean | undefined
  /** Bitfield1 flags from Weapons/Armor/Misc.txt (bit 0 = magic vendor generation eligible). */
  readonly bitfield1?: number | undefined
  /** Quest ID from quest column (non-zero for quest items). */
  readonly quest?: number | undefined
  /** Quest difficulty check from questdiffcheck column. */
  readonly questDiffCheck?: boolean | undefined
  /** Per-vendor generation columns keyed by VendorNpcId (0..16). */
  readonly vendorColumns?: Readonly<Record<number, {
    readonly min: number
    readonly max: number
    readonly magicMin: number
    readonly magicMax: number
    readonly magicLvl: number
  }>> | undefined
  /** Whether the item can spawn in normal gameplay or vendor stores. */
  readonly spawnable?: boolean | undefined
  /** 3-letter character paperdoll graphic token from alternategfx / alternateGfx column. */
  readonly alternategfx?: string | undefined
  /** Alias for alternategfx on WeaponBase. */
  readonly alternateGfx?: string | undefined
  /** Composite layer index (0=hd, 5=rh, 6=lh, 7=sh, 16=armor/misc). */
  readonly component?: number | undefined
  /** Armor component weight (0=lit, 1=med, 2=hvy) for Right Arm. */
  readonly rArm?: number | undefined
  /** Armor component weight (0=lit, 1=med, 2=hvy) for Left Arm. */
  readonly lArm?: number | undefined
  /** Armor component weight (0=lit, 1=med, 2=hvy) for Torso. */
  readonly torso?: number | undefined
  /** Armor component weight (0=lit, 1=med, 2=hvy) for Legs. */
  readonly legs?: number | undefined
  /** Armor component weight (0=lit, 1=med, 2=hvy) for Right Shoulder Pad (s1). */
  readonly rSPad?: number | undefined
  /** Armor component weight (0=lit, 1=med, 2=hvy) for Left Shoulder Pad (s2). */
  readonly lSPad?: number | undefined
  /** Character 3D/composite palette shift file index (0..8) from Transform column. */
  readonly transform?: number | undefined
  /** Inventory 2D icon palette shift file index (0..8) from InvTrans column. */
  readonly invTrans?: number | undefined
  /** Whether this weapon requires two hands (from Weapons.txt 2handed column). */
  readonly twoHanded?: boolean | undefined
  /** Whether a Barbarian can wield this two-handed weapon in one hand (from Weapons.txt 1or2handed column). */
  readonly oneOrTwoHanded?: boolean | undefined
}

/** One affix, read from a prefix or suffix row. */
export interface Affix {
  /** Table id. */
  readonly id: string
  /** Name as it appears in an item's name. */
  readonly name: string
  /** Which side of the name it attaches to. */
  readonly kind: 'prefix' | 'suffix'
  /** Minimum item level for the affix to be possible. */
  readonly level: number
  /** Item-type tags it applies to; empty means any. */
  readonly itemTypes: readonly string[]
  /** Stat modifiers it contributes. */
  readonly modifiers: readonly AffixModifier[]
}

/** One stat contribution of an affix. */
export interface AffixModifier {
  /** Stat name, as `ItemStatCost.txt` spells it. */
  readonly stat: string
  /** Minimum roll. */
  readonly min: number
  /** Maximum roll. */
  readonly max: number
}

/**
 * Known bitmask flags in D2 item header (`dwFlags`, 32-bit uint).
 * Corresponds to D2Common!6FD77180 (pack) / D2Common!6FD592C4 (unpack).
 */
export const ItemFlag = {
  IDENTIFIED: 1 << 0,     // 0x00000001 (item is identified)
  SOCKETED: 1 << 3,       // 0x00000008 (item has sockets / socketCount)
  NEW_ITEM: 1 << 4,       // 0x00000010 (new / unread since game start)
  IS_EAR: 1 << 7,         // 0x00000080 (player ear)
  STARTER_ITEM: 1 << 8,   // 0x00000100 (starter / newbie gear)
  SIMPLE: 1 << 11,        // 0x00000800 (compact item; terminates after code)
  ETHEREAL: 1 << 12,      // 0x00001000 (ethereal; cannot be repaired)
  ANY: 1 << 13,           // 0x00002000 (personalization flag)
  PERSONALIZED: 1 << 14,  // 0x00004000 (has personalized name)
  GAMBLE: 1 << 15,        // 0x00008000 (gambling item)
  RUNEWORD: 1 << 16,      // 0x00010000 (runeword item with runeword data)
} as const

export type ItemFlagKey = keyof typeof ItemFlag

/** Decoded boolean view of the 32-bit header flags bitmask. */
export interface ItemFlagsDecoded {
  readonly identified?: boolean | undefined
  readonly socketed?: boolean | undefined
  readonly newItem?: boolean | undefined
  readonly isEar?: boolean | undefined
  readonly starterItem?: boolean | undefined
  readonly simple?: boolean | undefined
  readonly ethereal?: boolean | undefined
  readonly personalized?: boolean | undefined
  readonly gamble?: boolean | undefined
  readonly runeword?: boolean | undefined
}

/** Location / storage mode of the item in D2 bitstream (3 bits). */
export type ItemMode = 0 | 1 | 2 | 3 | 4 | 5 | 6
export const ItemMode = {
  STORED: 0 as ItemMode,    // In inventory, stash, or Horadric Cube
  EQUIPPED: 1 as ItemMode,  // Equipped on character body
  BELT: 2 as ItemMode,      // Slotted in potion belt
  GROUND: 3 as ItemMode,    // Dropped on the ground
  CURSOR: 4 as ItemMode,    // Held on mouse cursor
  DROPPING: 5 as ItemMode,  // Currently in drop motion
  SOCKETED: 6 as ItemMode,  // Socketed into a parent item
} as const

/** Body equipment slot (4 bits). */
export type EquippedSlot = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12
export const EquippedSlot = {
  NONE: 0 as EquippedSlot,
  HEAD: 1 as EquippedSlot,
  NECK: 2 as EquippedSlot,
  TORSO: 3 as EquippedSlot,
  RIGHT_HAND: 4 as EquippedSlot,
  LEFT_HAND: 5 as EquippedSlot,
  RIGHT_FINGER: 6 as EquippedSlot,
  LEFT_FINGER: 7 as EquippedSlot,
  WAIST: 8 as EquippedSlot,
  FEET: 9 as EquippedSlot,
  HANDS: 10 as EquippedSlot,
  ALT_RIGHT_HAND: 11 as EquippedSlot,
  ALT_LEFT_HAND: 12 as EquippedSlot,
} as const

/** Container / storage page (3 bits). */
export type StoragePage = 0 | 1 | 2 | 4 | 5
export const StoragePage = {
  INVENTORY: 0 as StoragePage,
  EQUIPPED: 1 as StoragePage,
  BELT: 2 as StoragePage,
  CUBE: 4 as StoragePage,
  STASH: 5 as StoragePage,
} as const

/** Item location and positioning structure. */
export interface ItemLocation {
  /** Mode / location category (3 bits, 0-6). */
  readonly mode: ItemMode | number
  /** Ground position X (16 bits) if mode is GROUND (3) or DROPPING (5). */
  readonly worldX?: number | undefined
  /** Ground position Y (16 bits) if mode is GROUND (3) or DROPPING (5). */
  readonly worldY?: number | undefined
  /** Equipped body slot (4 bits) if mode is EQUIPPED (1). */
  readonly equippedSlot?: (EquippedSlot | number) | undefined
  /** Grid column (4 bits, 0-9) in inventory, stash, or cube. */
  readonly gridX?: number | undefined
  /** Grid row (4 bits, 0-9) in inventory, stash, or cube. */
  readonly gridY?: number | undefined
  /** Storage container / page (3 bits). */
  readonly storagePage?: (StoragePage | number) | undefined
}

/** Quality tier of the item (4 bits). */
export type ItemQuality = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
export const ItemQuality = {
  LOW: 1 as ItemQuality,       // Inferior / Low Quality / Cracked / Crude / Damaged
  NORMAL: 2 as ItemQuality,    // Normal base
  SUPERIOR: 3 as ItemQuality,  // Superior / High Quality
  MAGIC: 4 as ItemQuality,     // Magic
  SET: 5 as ItemQuality,       // Set
  RARE: 6 as ItemQuality,      // Rare
  UNIQUE: 7 as ItemQuality,    // Unique
  CRAFTED: 8 as ItemQuality,   // Crafted
  TEMPERED: 9 as ItemQuality,  // Tempered (expansion prototype remnant)
} as const

/** One affix slot for Rare / Crafted items (1 bit present + 11-bit id). */
export interface ItemAffixSlot {
  /** Whether the affix slot is present/populated (1 bit). */
  readonly present: boolean
  /** Affix ID from MagicPrefix.txt or MagicSuffix.txt (11 bits). */
  readonly id?: number | undefined
}

/** One stat modifier entry from the item stat bitstream block. */
export interface ItemStatEntry {
  /** Stat ID corresponding to ItemStatCost.txt (9 bits, 0..510; 0x1FF = terminator). */
  readonly statId: number
  /** Resolved stat name if known. */
  readonly statName?: string | undefined
  /** Param bits value (e.g. skill id, class id, charge count) if CSvParam > 0. */
  readonly param?: number | undefined
  /** Numerical value of the stat modifier (encoded with Save Bits and Save Add). */
  readonly value: number
}

/** Concrete rolled property on an Item instance. */
export interface RolledItemProp {
  readonly code: string
  readonly param?: string | number | undefined
  readonly min: number
  readonly max: number
  readonly value: number
}

/** Runeword metadata attached to runeword items. */
export interface ItemRunewordData {
  /** Runeword ID (12 bits) from Runes.txt. */
  readonly id: number
  /** Runeword display/reference name (e.g. "Ancient's Pledge", "Stealth"). */
  readonly name?: string | undefined
  /** Runeword parameter / property index (4 bits). */
  readonly param?: number | undefined
}

/** Player ear specific data if IsEar flag is set. */
export interface ItemEarData {
  /** Class of the ear's victim (3 bits). */
  readonly classIndex: number
  /** Level of the victim (7 bits). */
  readonly level: number
  /** Character name of the victim (7-bit ASCII string). */
  readonly name: string
}

/**
 * Decode a 32-bit flags integer into an ItemFlagsDecoded object.
 */
export function decodeItemFlags(rawFlags: number): ItemFlagsDecoded {
  return {
    identified: (rawFlags & ItemFlag.IDENTIFIED) !== 0,
    socketed: (rawFlags & ItemFlag.SOCKETED) !== 0,
    newItem: (rawFlags & ItemFlag.NEW_ITEM) !== 0,
    isEar: (rawFlags & ItemFlag.IS_EAR) !== 0,
    starterItem: (rawFlags & ItemFlag.STARTER_ITEM) !== 0,
    simple: (rawFlags & ItemFlag.SIMPLE) !== 0,
    ethereal: (rawFlags & ItemFlag.ETHEREAL) !== 0,
    personalized: (rawFlags & ItemFlag.PERSONALIZED) !== 0,
    gamble: (rawFlags & ItemFlag.GAMBLE) !== 0,
    runeword: (rawFlags & ItemFlag.RUNEWORD) !== 0,
  }
}

/**
 * Encode an ItemFlagsDecoded object back into a 32-bit flags integer.
 */
export function encodeItemFlags(flags: ItemFlagsDecoded): number {
  let raw = 0
  if (flags.identified) raw |= ItemFlag.IDENTIFIED
  if (flags.socketed) raw |= ItemFlag.SOCKETED
  if (flags.newItem) raw |= ItemFlag.NEW_ITEM
  if (flags.isEar) raw |= ItemFlag.IS_EAR
  if (flags.starterItem) raw |= ItemFlag.STARTER_ITEM
  if (flags.simple) raw |= ItemFlag.SIMPLE
  if (flags.ethereal) raw |= ItemFlag.ETHEREAL
  if (flags.personalized) raw |= ItemFlag.PERSONALIZED
  if (flags.gamble) raw |= ItemFlag.GAMBLE
  if (flags.runeword) raw |= ItemFlag.RUNEWORD
  return raw >>> 0
}

/** Format an item ID into a 4-character right-padded ASCII item code. */
export function formatItemCode(id: string): string {
  return (id + '    ').slice(0, 4)
}

/** Get string representation of item quality. */
export function getItemQualityName(quality: ItemQuality | number): string {
  switch (quality) {
    case ItemQuality.LOW: return 'low'
    case ItemQuality.NORMAL: return 'normal'
    case ItemQuality.SUPERIOR: return 'superior'
    case ItemQuality.MAGIC: return 'magic'
    case ItemQuality.SET: return 'set'
    case ItemQuality.RARE: return 'rare'
    case ItemQuality.UNIQUE: return 'unique'
    case ItemQuality.CRAFTED: return 'crafted'
    case ItemQuality.TEMPERED: return 'tempered'
    default: return 'normal'
  }
}

/** A concrete item. */
export interface Item {
  /** Optional runtime item identifier. */
  readonly id?: string | number | undefined
  /** Base definition. */
  readonly base: ItemBase
  /** Rolled prefix, if any. */
  readonly prefix: Affix | null
  /** Rolled suffix, if any. */
  readonly suffix: Affix | null
  /** Item level the affixes were rolled at. */
  readonly level: number
  /** Final name, affixes included. */
  readonly name: string
  /** Optional localized Chinese display name resolved from .tbl. */
  readonly nameZh?: string | undefined
  /** Final stats: base plus every rolled modifier. */
  readonly stats: Readonly<Record<string, number>>
  /** Inventory footprint. */
  readonly invWidth: number
  /** Inventory footprint. */
  readonly invHeight: number
  /** How many are stacked here. */
  readonly stack: number
  /** Gold value of one unit. */
  readonly value: number

  // --- Extended & Bit-Aligned Fields for .d2s Serialization (D2Common!6FD77180) ---
  /** 32-bit raw header flags bitmask (`dwFlags`). Preserved for lossless round-trip. */
  readonly rawFlags?: number | undefined
  /** Decoded boolean representation of flags for ergonomic inspection. */
  readonly flags?: ItemFlagsDecoded | undefined
  /** Save file format version (10 bits, e.g. 0 or 101/0x65 for 1.10+). */
  readonly version?: number | undefined
  /** Location/mode and grid coordinates. */
  readonly location?: ItemLocation | undefined
  /** 4-character ASCII item code (e.g. "swd ", "gld "). Stored as 32 bits. */
  readonly code?: string | undefined
  /** Number of items socketed inside this item (3 bits, 0..7). */
  readonly socketedCount?: number | undefined
  /** Sockets content list (the socketed items themselves). */
  readonly socketedItems?: readonly Item[] | undefined

  // --- Extended Item Fields (omitted when simple is true) ---
  /** Unique item GUID / seed (`dwInitSeed`, 32 bits). */
  readonly uniqueId?: number | undefined
  /** Item level (7 bits, 0..127). Mirrors `level`. */
  readonly ilvl?: number | undefined
  /** Alias for `ilvl` / `level`. */
  readonly itemLevel?: number | undefined
  /** Item quality tier (4 bits, 1..8). */
  readonly quality?: (ItemQuality | number) | undefined
  /** Rarity string for game/scene compatibility ('normal' | 'magic' | 'rare' | 'unique' | 'set' | 'crafted'). */
  readonly rarity?: string | undefined
  /** Whether graphic variation index is present (1 bit). */
  readonly hasGraphic?: boolean | undefined
  /** Graphic variation index (3 bits) if hasGraphic is true. */
  readonly graphic?: number | undefined
  /** Whether auto-affix is present (1 bit). */
  readonly hasAutoAffix?: boolean | undefined
  /** Automagic / class auto-affix ID (11 bits) from AutoMagic.txt. */
  readonly autoAffixId?: number | undefined

  // --- Quality Branches ---
  /** Low quality subtype (3 bits: 0 crude, 1 cracked, 2 damaged, 3 low quality). */
  readonly qualitySubtype?: number | undefined
  /** Superior quality subtype (3 bits: 0 ar, 1 dmg, 2 def, etc.). */
  readonly superiorSubtype?: number | undefined
  /** Magic prefix ID (11 bits) from MagicPrefix.txt. */
  readonly magicPrefixId?: number | undefined
  /** Magic suffix ID (11 bits) from MagicSuffix.txt. */
  readonly magicSuffixId?: number | undefined
  /** Set item ID (12 bits) from SetItems.txt. */
  readonly setId?: number | undefined
  /** Rare / Crafted name prefix word ID (8 bits) from RarePrefix.txt. */
  readonly rareName1?: number | undefined
  /** Rare / Crafted name suffix word ID (8 bits) from RareSuffix.txt. */
  readonly rareName2?: number | undefined
  /** 6 Rare / Crafted affix slots (each 1 bit present + 11-bit id). */
  readonly rareAffixes?: readonly ItemAffixSlot[] | undefined

  // --- Special Extensions & Attributes ---
  /** Runeword data (12 bits id + 4 bits param) if runeword flag is set. */
  readonly runeword?: ItemRunewordData | undefined
  /** Personalized character name if personalized flag is set. */
  readonly personalizedName?: string | undefined
  /** Tome ID (5 bits) for town portal / identify tomes. */
  readonly tomeId?: number | undefined
  /** Realm data (1 bit flag + 96 bits) for Battle.net character saves. */
  readonly realmData?: Uint8Array | undefined
  /** Current / rolled armor defense value (11 bits). */
  readonly defense?: number | undefined
  /** Current durability (8 bits). */
  durability?: number | undefined
  /** Maximum durability (8 bits). */
  readonly maxDurability?: number | undefined
  /** Quantity (9 bits) if stackable (mirrors `stack`). */
  readonly quantity?: number | undefined
  /** Total number of sockets (4 bits, 1..6) if socketed flag is set. */
  readonly totalSockets?: number | undefined
  /** Definition for Unique items from UniqueItems.txt. */
  readonly uniqueItemDef?: any | undefined
  /** Definition for Set items from SetItems.txt. */
  readonly setItemDef?: any | undefined
  /** Rolled affixes and modifiers for Rare items. */
  readonly rolledRareAffixes?: any | undefined
  /** Rolled affixes and modifiers for Magic items. */
  readonly rolledMagicAffixes?: any | undefined
  /** Rolled concrete properties for Unique / Set items. */
  readonly rolledProps?: readonly RolledItemProp[] | undefined

  // --- Stat Modifier Lists ---
  /** Base stat list entries (each 9-bit statId + params/values, terminated by 0x1FF). */
  readonly statList?: readonly ItemStatEntry[] | undefined
  /** Set bonus stat lists for set items (each block terminated by 0x1FF). */
  readonly setBonuses?: readonly (readonly ItemStatEntry[])[] | undefined
  /** Runeword bonus stat list (terminated by 0x1FF). */
  readonly runewordStats?: readonly ItemStatEntry[] | undefined

  // --- Vendor & Staffmod Extensions ---
  /** Whether this item in a vendor inventory has infinite stock (PermStoreItem). */
  readonly permStore?: boolean | undefined
  /** Rolled single-skill staffmods (up to 3 skills on wands/staves/scepters/orbs/heads/pelts/primal helms). */
  readonly staffMods?: readonly RolledItemProp[] | undefined
  /** Whether this item is an unrevealed mystery item in the Gamble window. */
  readonly isGambleMystery?: boolean | undefined
  /** Whether this item is identified. */
  identified?: boolean | undefined

  // --- Ear Item Data ---
  /** Player ear details if IsEar flag is set. */
  readonly earData?: ItemEarData | undefined

  // --- Preservation for Lossless Round-Trip ---
  /** Unparsed trailing bits or unknown raw bitstream bytes to ensure lossless re-saving. */
  readonly unknownBits?: Uint8Array | undefined
}

/** A rectangle in the inventory grid. */
export interface GridPlacement {
  /** Column of the item's left edge. */
  readonly x: number
  /** Row of the item's top edge. */
  readonly y: number
}

/** An item occupying a spot in the inventory. */
export interface PlacedItem extends GridPlacement {
  /** The item itself. */
  readonly item: Item
}

/** Default footprint for a base whose row omits one. */
const DEFAULT_SIZE = 1

/**
 * Read an item base from a table row.
 *
 * @param row - the record.
 * @param kind - which table the row came from.
 * @param rowIndex - position, for a fallback id.
 * @returns the base.
 */
export function itemBaseFromRow(
  row: Readonly<Record<string, string>>,
  kind: ItemKind,
  rowIndex: number,
): ItemBase {
  const id = textCell(row, 'Id', textCell(row, 'code', `${kind}${String(rowIndex)}`))
  const tags = textCell(row, 'Type', textCell(row, 'type', kind))
    .split(/[,\s]+/)
    .filter(tag => tag !== '')
  const dropsound = textCell(row, 'dropsound', textCell(row, 'DropSound', '')) || undefined
  const dropsfxframe = numberCell(row, 'dropsfxframe', numberCell(row, 'DropSfxFrame', 0)) || undefined
  return {
    id,
    name: textCell(row, 'Name', textCell(row, 'name', id)),
    kind,
    invWidth: numberCell(row, 'InvWidth', numberCell(row, 'invwidth', DEFAULT_SIZE)),
    invHeight: numberCell(row, 'InvHeight', numberCell(row, 'invheight', DEFAULT_SIZE)),
    maxStack: Math.max(1, numberCell(row, 'MaxStack', numberCell(row, 'maxstack', 1))),
    value: Math.max(0, numberCell(row, 'Value', numberCell(row, 'cost', 1))),
    damage: Math.max(0, numberCell(row, 'Damage', numberCell(row, 'mindam', 0))),
    defense: Math.max(0, numberCell(row, 'Defense', numberCell(row, 'minac', 0))),
    tags,
    level: Math.max(0, numberCell(row, 'Level', numberCell(row, 'level', 1))),
    ...(dropsound ? { dropsound } : {}),
    ...(dropsfxframe !== undefined ? { dropsfxframe } : {}),
  }
}

/**
 * Read every base in a table.
 *
 * @param table - a weapons/armor/misc table.
 * @param kind - which kind the table holds.
 * @returns the bases.
 */
export function itemBasesFromTable(table: DataTable, kind: ItemKind): ItemBase[] {
  return table.rows.map((row, index) => itemBaseFromRow(row, kind, index))
}

/**
 * How many modifier slots the loader looks for.
 *
 * Diablo II's affix rows carry `mod1code/mod1min/mod1max` through `mod3…` for
 * prefixes and suffixes alike; three is the shipped maximum.
 */
const MODIFIER_SLOTS = 3
/**
 * How many item-type slots an affix row may restrict itself to (`itype1..7`).
 */
const ITYPE_SLOTS = 7

/**
 * Read one affix from a prefix/suffix row.
 *
 * @param row - the record.
 * @param kind - which side of the name the affix attaches to.
 * @param rowIndex - position, for a fallback id.
 * @returns the affix, or null when the row has no usable modifier.
 */
export function affixFromRow(
  row: Readonly<Record<string, string>>,
  kind: 'prefix' | 'suffix',
  rowIndex: number,
): Affix | null {
  const modifiers: AffixModifier[] = []
  for (let slot = 1; slot <= MODIFIER_SLOTS; slot += 1) {
    const stat = textCell(row, `mod${String(slot)}code`, textCell(row, `Mod${String(slot)}Code`, ''))
    if (stat === '') continue
    const min = numberCell(row, `mod${String(slot)}min`, numberCell(row, `Mod${String(slot)}Min`, 0))
    const max = numberCell(row, `mod${String(slot)}max`, numberCell(row, `Mod${String(slot)}Max`, min))
    modifiers.push({ stat, min, max: Math.max(min, max) })
  }
  if (modifiers.length === 0) return null
  const itemTypes: string[] = []
  for (let slot = 1; slot <= ITYPE_SLOTS; slot += 1) {
    const value = textCell(row, `itype${String(slot)}`, textCell(row, `IType${String(slot)}`, ''))
    for (const tag of value.split(/[,\s]+/)) if (tag !== '') itemTypes.push(tag)
  }
  const id = textCell(row, 'Id', textCell(row, 'Name', `${kind}${String(rowIndex)}`))
  return {
    id,
    name: textCell(row, 'Name', id),
    kind,
    level: Math.max(0, numberCell(row, 'Level', numberCell(row, 'lvl', 1))),
    itemTypes,
    modifiers,
  }
}

/**
 * Read every affix in a table.
 *
 * @param table - a `MagicPrefix` or `MagicSuffix` shaped table.
 * @param kind - which side of the name the rows attach to.
 * @returns the affixes, with unusable rows skipped.
 */
export function affixesFromTable(table: DataTable, kind: 'prefix' | 'suffix'): Affix[] {
  const affixes: Affix[] = []
  table.rows.forEach((row, index) => {
    const affix = affixFromRow(row, kind, index)
    if (affix !== null) affixes.push(affix)
  })
  return affixes
}

/**
 * Whether an affix may roll on a base at a given item level.
 *
 * @param affix - the affix.
 * @param base - the base item.
 * @param level - the item level being rolled.
 * @returns true when the affix is eligible.
 */
export function affixEligible(affix: Affix, base: ItemBase, level: number): boolean {
  if (affix.level > level) return false
  if (affix.itemTypes.length === 0) return true
  // Diablo II matches the affix's `itype` list against the item's type list; an
  // affix naming a type the base does not carry cannot roll on it.
  return affix.itemTypes.some(tag => base.tags.includes(tag))
}

/**
 * Roll one affix for a base.
 *
 * @param affixes - the candidate affixes.
 * @param base - the base item.
 * @param level - the item level.
 * @param rng - the random source.
 * @returns the affix and its rolled modifiers, or null when none is eligible.
 */
export function rollAffix(
  affixes: readonly Affix[],
  base: ItemBase,
  level: number,
  rng: Rng,
): { affix: Affix; rolls: AffixModifier[] } | null {
  const eligible = affixes.filter(affix => affixEligible(affix, base, level))
  const affix = rng.pick(eligible)
  if (affix === undefined) return null
  const rolls = affix.modifiers.map(modifier => ({
    stat: modifier.stat,
    min: rng.int(modifier.min, modifier.max),
    max: rng.int(modifier.min, modifier.max),
  }))
  return { affix, rolls }
}

/** Options controlling how an item is built. */
export interface CreateItemOptions {
  /** Item level; gates affixes. */
  readonly level: number
  /** Chance that a prefix rolls at all. */
  readonly prefixChance?: number
  /** Chance that a suffix rolls at all. */
  readonly suffixChance?: number
  /** How many units are stacked. */
  readonly stack?: number
}

/**
 * Build an item from a base, rolling its affixes.
 *
 * @param base - the base.
 * @param prefixes - candidate prefixes.
 * @param suffixes - candidate suffixes.
 * @param rng - the random source.
 * @param options - level, chances and stack size.
 * @returns the item.
 */
export function createItem(
  base: ItemBase,
  prefixes: readonly Affix[],
  suffixes: readonly Affix[],
  rng: Rng,
  options: CreateItemOptions,
): Item {
  const prefixChance = options.prefixChance ?? 0.45
  const suffixChance = options.suffixChance ?? 0.45
  const prefix = rng.chance(prefixChance) ? rollAffix(prefixes, base, options.level, rng) : null
  const suffix = rng.chance(suffixChance) ? rollAffix(suffixes, base, options.level, rng) : null

  const stats: Record<string, number> = {}
  if (base.damage > 0) stats.damage = base.damage
  if (base.defense > 0) stats.defense = base.defense
  for (const rolled of [prefix, suffix]) {
    if (rolled === null) continue
    for (const roll of rolled.rolls) {
      stats[roll.stat] = (stats[roll.stat] ?? 0) + roll.max
    }
  }

  const name = [prefix?.affix.name, base.name, suffix?.affix.name].filter(part => part !== undefined && part !== '').join(' ')
  // An affixed item is worth more; the multiplier is a stand-in for the game's
  // per-modifier pricing.
  const affixCount = (prefix === null ? 0 : 1) + (suffix === null ? 0 : 1)
  const value = Math.max(1, Math.round(base.value * (1 + affixCount * 0.75)))

  const code = formatItemCode(base.id)
  const isMagic = prefix !== null || suffix !== null
  const quality = isMagic ? ItemQuality.MAGIC : ItemQuality.NORMAL
  const rawFlags = ItemFlag.IDENTIFIED | (base.kind === 'misc' && base.maxStack > 1 ? ItemFlag.SIMPLE : 0)
  const defense = base.defense > 0 ? (stats.defense ?? base.defense) : undefined
  const stack = Math.max(1, Math.min(options.stack ?? 1, base.maxStack))

  return {
    base,
    prefix: prefix?.affix ?? null,
    suffix: suffix?.affix ?? null,
    level: options.level,
    name,
    stats,
    invWidth: base.invWidth,
    invHeight: base.invHeight,
    stack,
    value,
    rawFlags,
    flags: decodeItemFlags(rawFlags),
    version: 0x65,
    code,
    ilvl: options.level,
    quality,
    rarity: getItemQualityName(quality),
    defense,
    quantity: stack,
  }
}

/**
 * The inventory: a grid of cells, each either empty or holding a placed item.
 */
export class Inventory {
  /** Grid width in cells. */
  readonly width: number
  /** Grid height in cells. */
  readonly height: number
  private readonly cells: (number | null)[]
  public readonly items: PlacedItem[] = []
  private nextId = 1
  private _gold = 0

  /**
   * @param width - grid width in cells.
   * @param height - grid height in cells.
   */
  constructor(width = 10, height = 4) {
    this.width = width
    this.height = height
    this.cells = new Array<number | null>(width * height).fill(null)
  }

  /** Items currently placed. */
  get contents(): readonly PlacedItem[] {
    return this.items
  }

  /** Return all placed items. */
  list(): readonly PlacedItem[] {
    return this.items
  }

  /** Return all placed items. */
  getAllItems(): readonly PlacedItem[] {
    return this.items
  }

  /** Return the placement occupying cell (x, y), or null. */
  at(x: number, y: number): PlacedItem | null {
    return (
      this.items.find(
        p =>
          x >= p.x &&
          x < p.x + p.item.invWidth &&
          y >= p.y &&
          y < p.y + p.item.invHeight,
      ) ?? null
    )
  }

  /**Occupied cell count. */
  get usedCells(): number {
    return this.items.reduce((total, placed) => total + placed.item.invWidth * placed.item.invHeight, 0)
  }

  /** Total cell count. */
  get totalCells(): number {
    return this.width * this.height
  }

  /**
   * Whether an item of a given size fits at a position.
   *
   * @param width - item width.
   * @param height - item height.
   * @param x - column.
   * @param y - row.
   * @returns true when the whole footprint is inside the grid and empty.
   */
  canPlace(width: number, height: number, x: number, y: number): boolean {
    if (x < 0 || y < 0 || x + width > this.width || y + height > this.height) return false
    for (let row = y; row < y + height; row += 1) {
      for (let column = x; column < x + width; column += 1) {
        if (this.cells[row * this.width + column] !== null) return false
      }
    }
    return true
  }

  /**
   * Place an item at explicit grid coordinates (x, y).
   */
  place(item: Item, x: number, y: number): PlacedItem {
    const invWidth = typeof item.invWidth === 'number' ? item.invWidth : (item.base?.invWidth ?? 1)
    const invHeight = typeof item.invHeight === 'number' ? item.invHeight : (item.base?.invHeight ?? 1)
    if (!this.canPlace(invWidth, invHeight, x, y)) {
      throw new Error(`item "${item.name}" does not fit at ${String(x)},${String(y)}`)
    }
    const id = this.nextId
    this.nextId += 1
    for (let row = y; row < y + invHeight; row += 1) {
      for (let column = x; column < x + invWidth; column += 1) {
        this.cells[row * this.width + column] = id
      }
    }
    const placed: PlacedItem = { x, y, item }
    this.items.push(placed)
    return placed
  }

  /**
   * Add an item, stacking onto an existing stack when possible.
   *
   * @param item - the item to add.
   * @returns where it landed, or null when there was no room.
   */
  add(item: Item): PlacedItem | null {
    // Stack first: a second potion belongs on the first one, not beside it.
    const maxStack = item.base?.maxStack ?? 1
    if (maxStack > 1) {
      for (const placed of this.items) {
        const placedBaseId = placed.item.base?.id
        const itemBaseId = item.base?.id
        if (!itemBaseId || placedBaseId !== itemBaseId) continue
        const placedMaxStack = placed.item.base?.maxStack ?? 1
        const room = placedMaxStack - placed.item.stack
        if (room <= 0) continue
        const moved = Math.min(room, item.stack ?? 1)
        const nextStack = placed.item.stack + moved
        const merged: Item = {
          ...placed.item,
          stack: nextStack,
          ...(placed.item.quantity !== undefined ? { quantity: nextStack } : {}),
        }
        this.items[this.items.indexOf(placed)] = { ...placed, item: merged }
        const leftover = (item.stack ?? 1) - moved
        if (leftover <= 0) return { ...placed, item: merged }
        return this.add({
          ...item,
          stack: leftover,
          ...(item.quantity !== undefined ? { quantity: leftover } : {}),
        })
      }
    }
    const invWidth = typeof item.invWidth === 'number' ? item.invWidth : (item.base?.invWidth ?? 1)
    const invHeight = typeof item.invHeight === 'number' ? item.invHeight : (item.base?.invHeight ?? 1)
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        if (!this.canPlace(invWidth, invHeight, x, y)) continue
        const id = this.nextId
        this.nextId += 1
        for (let row = y; row < y + invHeight; row += 1) {
          for (let column = x; column < x + invWidth; column += 1) {
            this.cells[row * this.width + column] = id
          }
        }
        const placed: PlacedItem = { x, y, item }
        this.items.push(placed)
        return placed
      }
    }
    return null
  }

  /**
   * Remove an item by its placement or cell coordinates (x, y).
   */
  remove(placedOrX: PlacedItem | number, maybeY?: number): boolean {
    const placed =
      typeof placedOrX === 'number'
        ? this.at(placedOrX, maybeY ?? 0)
        : placedOrX
    if (!placed) return false
    const index = this.items.indexOf(placed)
    if (index === -1) return false
    for (let row = placed.y; row < placed.y + placed.item.invHeight; row += 1) {
      for (let column = placed.x; column < placed.x + placed.item.invWidth; column += 1) {
        this.cells[row * this.width + column] = null
      }
    }
    this.items.splice(index, 1)
    return true
  }

  /**
   * Rebuild an inventory from explicit placements.
   *
   * A save restores items where they were, not wherever the first free slot
   * happens to be today: an item that moved on load would be a save that lies.
   * Placements are validated, so a corrupt save fails loudly instead of producing
   * an overlapping bag.
   *
   * @param width - grid width.
   * @param height - grid height.
   * @param entries - placements to restore.
   * @returns the inventory.
   */
  static restore(width: number, height: number, entries: readonly PlacedItem[]): Inventory {
    const inventory = new Inventory(width, height)
    for (const entry of entries) {
      if (!inventory.canPlace(entry.item.invWidth, entry.item.invHeight, entry.x, entry.y)) {
        throw new Error(`saved item "${entry.item.name}" does not fit at ${String(entry.x)},${String(entry.y)}`)
      }
      const id = inventory.nextId
      inventory.nextId += 1
      for (let row = entry.y; row < entry.y + entry.item.invHeight; row += 1) {
        for (let column = entry.x; column < entry.x + entry.item.invWidth; column += 1) {
          inventory.cells[row * width + column] = id
        }
      }
      inventory.items.push({ x: entry.x, y: entry.y, item: entry.item })
    }
    return inventory
  }

  /** How much gold is held, summed over dedicated gold stat and any placed gold stacks. */
  get gold(): number {
    return (
      this._gold +
      this.items
        .filter(placed => placed.item.base?.id === 'gold')
        .reduce((total, placed) => total + (placed.item.stack ?? 0), 0)
    )
  }

  set gold(amount: number) {
    const target = Math.max(0, Math.floor(amount))
    const goldIndices: number[] = []
    this.items.forEach((p, idx) => {
      if (p.item.base?.id === 'gold') goldIndices.push(idx)
    })
    for (let i = goldIndices.length - 1; i >= 0; i--) {
      const p = this.items[goldIndices[i]!]!
      const id = this.cells[p.y * this.width + p.x]
      for (let r = 0; r < (p.item.invHeight ?? 1); r++) {
        for (let c = 0; c < (p.item.invWidth ?? 1); c++) {
          const cellIdx = (p.y + r) * this.width + (p.x + c)
          if (this.cells[cellIdx] === id) this.cells[cellIdx] = null
        }
      }
      this.items.splice(goldIndices[i]!, 1)
    }
    this._gold = target
  }

  /** Dedicated gold counter not stored as grid items. */
  get dedicatedGold(): number {
    return this._gold
  }

  set dedicatedGold(amount: number) {
    this._gold = Math.max(0, Math.floor(amount))
  }
}

/** A gold base, created on demand so gold needs no table row. */
export const GOLD_BASE: ItemBase = {
  id: 'gold',
  name: 'Gold',
  kind: 'misc',
  invWidth: 1,
  invHeight: 1,
  maxStack: 2_500_000,
  value: 1,
  damage: 0,
  defense: 0,
  tags: ['gold'],
  level: 0,
}

/**
 * Build a gold pile.
 *
 * @param amount - how much gold.
 * @returns the item.
 */
export function goldItem(amount: number): Item {
  const stack = Math.max(1, Math.floor(amount))
  const rawFlags = ItemFlag.IDENTIFIED | ItemFlag.SIMPLE
  return {
    base: GOLD_BASE,
    prefix: null,
    suffix: null,
    level: 0,
    name: 'Gold',
    stats: {},
    invWidth: 1,
    invHeight: 1,
    stack,
    value: stack,
    rawFlags,
    flags: decodeItemFlags(rawFlags),
    version: 0x65,
    code: 'gld ',
    quality: ItemQuality.NORMAL,
    rarity: 'normal',
    quantity: stack,
  }
}

/**
 * Sum a held stat across everything carried, for the character sheet.
 *
 * @param items - placed items.
 * @param stat - the stat name.
 * @returns the total.
 */
export function totalStat(items: readonly PlacedItem[], stat: string): number {
  return items.reduce((total, placed) => total + (placed.item.stats[stat] ?? 0), 0)
}
