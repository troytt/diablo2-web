/**
 * Server-side 1.13c item helpers for `GameInstance` (#1326):
 *
 * - `domainItemToItemData113c`: turns an `Item` produced by the canonical 1.13c generators
 *   (`executeDropPipeline`, `generateVendorStoreInventory`, `generateGambleInventory`, `resolveGambledItem`)
 *   into the `ItemData` record the S2C `0x9C`/`0x9D` item path and the client item bridge
 *   (`onlineItemDataToUiInventoryItem`, `itemToTransactionCostInput`) read.
 * - `resolveChestDropContext113c`: the `Act N [(N)|(H)] Chest A|B|C` treasure class and drop level that
 *   D2Game.dll 0x6fc8b570 picks for an operated container.
 * - `CONTAINER_OPERATE_DROP_CHANCE_113C`: which Objects.txt `OperateFn` values drop from that chest TC and
 *   with which per-operate chance.
 */

import { ItemQuality, type Item, type ItemBase, type RolledItemProp } from '../../common/items/items.ts'
import type { ItemQualityTier } from '../../common/items/item-ratio.ts'
import { CANONICAL_GEMS_TABLE, type GemModifier } from '../../common/items/gems.ts'
import { getEmbeddedDropTables } from '../../common/items/embedded-drop-tables.ts'
import { rolledPropsToItemStats } from '../../common/items/item-bridge.ts'
import { resolveGemApplyType } from '../../common/items/runeword-socket.ts'
import {
  NON_RANDOM_RANGE_CODES,
  type GeneratedAffixes,
  type GeneratedRareAffixes,
  type RolledAffix,
} from '../../common/items/affix-generator.ts'
import type { RolledAutoMagic } from '../../common/items/automagic.ts'
import type { DropTables } from '../../common/items/drop-tables.ts'
import { rollArmorWireBaseDefense113c } from '../../common/items/vendor-generator.ts'
import { D2Rng } from '../../common/rng/d2-rng.ts'
import { getLevelMonsterLevel113c, getLevelsMonLvlRecord113c } from '../../common/world/levels-monlvl-113c.ts'
import {
  ITEM_FLAG_COMPACT,
  ITEM_FLAG_ETHEREAL,
  ITEM_FLAG_IDENTIFIED,
  ITEM_FLAG_SIMPLE_EXTENDED,
  ITEM_FLAG_SOCKETED,
  type ItemData,
  type ItemQuality as WireItemQuality,
  type ItemStat,
  type SetBonusStatList,
} from '../../netproto/index.ts'
import { rollSetBonusPropIfNeeded, type SetItem, type SetItemTable } from '../../common/items/set-items.ts'

/** The `Item` fields the canonical generators attach beyond the declared interface. */
interface GeneratedItemExtras {
  readonly identified?: boolean | undefined
  readonly ethereal?: boolean | undefined
  readonly sockets?: number | undefined
  readonly rolledAutoMagic?: RolledAutoMagic | undefined
  readonly isGambleMystery?: boolean | undefined
  readonly personalized?: boolean | undefined
  readonly personalizedName?: string | undefined
  readonly rolledSetBonusProps?: readonly { readonly index: number; readonly props: readonly RolledItemProp[] }[] | undefined
  readonly setBonusStats?: readonly SetBonusStatList[] | undefined
  readonly runeword?: boolean | undefined
  readonly runewordId?: number | undefined
  readonly runewordStats?: readonly ItemStat[] | undefined
  readonly rolledRunewordProps?: readonly RolledItemProp[] | undefined
  readonly wireBaseDefense?: number | undefined
  readonly rolledBaseDefense?: number | undefined
}

function normalizeWireItemQuality(raw: unknown): WireItemQuality {
  if (typeof raw === 'number' && raw >= 1 && raw <= 8) return raw as WireItemQuality
  if (typeof raw === 'string') {
    switch (raw.trim().toLowerCase()) {
      case 'low':
        return ItemQuality.LOW as WireItemQuality
      case 'normal':
        return ItemQuality.NORMAL as WireItemQuality
      case 'superior':
        return ItemQuality.SUPERIOR as WireItemQuality
      case 'magic':
        return ItemQuality.MAGIC as WireItemQuality
      case 'set':
        return ItemQuality.SET as WireItemQuality
      case 'rare':
        return ItemQuality.RARE as WireItemQuality
      case 'unique':
        return ItemQuality.UNIQUE as WireItemQuality
      case 'crafted':
        return ItemQuality.CRAFTED as WireItemQuality
    }
  }
  return ItemQuality.NORMAL as WireItemQuality
}

export interface DomainItemToItemDataOptions {
  /** Server unit id of the item. */
  readonly unitId: number
  /** Armor.txt / Weapons.txt / Misc.txt `compactsave` of the base: the item is sent as a compact (simple) record. */
  readonly compactSave: boolean
}

function affixPacketId(rolled: RolledAffix, what: string): number {
  const id = rolled.affix.id
  if (typeof id !== 'number' || id <= 0) {
    throw new Error(`domainItemToItemData113c: ${what} '${rolled.affix.name}' has no MagicPrefix/MagicSuffix row id`)
  }
  return id
}

function toWireStats(props: readonly RolledItemProp[] | undefined, baseCode?: string): ItemStat[] {
  return rolledPropsToItemStats(props, baseCode ? { baseCode } : undefined).map((s) => {
    if (typeof s.statId !== 'number') throw new Error('domainItemToItemData113c: rolled property without an ItemStatCost id')
    return { statId: s.statId, param: s.param ?? 0, value: s.value }
  })
}

function buildSetBonusStatLists113c(
  item: Item & GeneratedItemExtras,
  setItemDef: SetItem | undefined,
  baseCode: string,
): SetBonusStatList[] {
  if (Array.isArray(item.setBonusStats) && item.setBonusStats.length > 0) {
    return [...item.setBonusStats]
  }
  if (Array.isArray(item.rolledSetBonusProps) && item.rolledSetBonusProps.length > 0) {
    return item.rolledSetBonusProps.map(({ index, props }) => ({
      index,
      stats: toWireStats(props, baseCode),
    }))
  }
  if (!setItemDef?.aprops || setItemDef.aprops.length === 0) return []
  const rng = new D2Rng(((item.uniqueId ?? 1) ^ 0x5e7b0000) >>> 0 || 1)
  const byIndex = new Map<number, RolledItemProp[]>()
  for (const ap of setItemDef.aprops) {
    if (!ap.code) continue
    const idx = ap.threshold - 1
    if (idx < 0 || idx > 4) continue
    const isNonRandom = NON_RANDOM_RANGE_CODES.has(ap.code.trim().toLowerCase())
    const val =
      isNonRandom || ap.min === ap.max
        ? ap.min
        : rng.randRange(Math.min(ap.min, ap.max), Math.max(ap.min, ap.max))
    const list = byIndex.get(idx) ?? []
    list.push({
      code: ap.code,
      param: ap.par,
      min: ap.min,
      max: ap.max,
      value: val,
    })
    byIndex.set(idx, list)
  }
  return [...byIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, props]) => ({ index, stats: toWireStats(props, baseCode) }))
}

/**
 * Converts a generated 1.13c `Item` into a complete `ItemData` record (container/position fields are
 * placeholders; `GameInstance.serverEntryToItemData` overrides them from the server entry).
 *
 * Rare names use the combined RareSuffix/RarePrefix id space the item bitstream carries (suffix ids
 * `1..suffixCount`, prefix ids follow), and rare affixes are sent as 3 (prefix, suffix) pairs.
 */
export function domainItemToItemData113c(
  item: Item,
  tables: DropTables,
  options: DomainItemToItemDataOptions,
): ItemData {
  const extras = item as Item & GeneratedItemExtras
  // Items.txt code (gold's base row is 'gold' but its Misc.txt / wire code is 'gld').
  const code = (item.code ?? item.base.id).trim()
  const isGold = code === 'gld'
  const quality = normalizeWireItemQuality(item.quality ?? item.rarity)
  const isGambleMystery = extras.isGambleMystery === true
  const identified = isGambleMystery ? false : (extras.identified ?? item.flags?.identified ?? false)
  const ethereal = Boolean(extras.ethereal)
  const personalized = Boolean(extras.personalized ?? item.flags?.personalized)
  const personalizedName = extras.personalizedName
  const totalSockets = item.totalSockets ?? extras.sockets ?? 0
  const quantity = item.quantity ?? item.stack
  const simple = options.compactSave

  let magicPrefixId: number | undefined
  let magicSuffixId: number | undefined
  const magic = item.rolledMagicAffixes as GeneratedAffixes | undefined
  if (quality === ItemQuality.MAGIC && magic) {
    magicPrefixId = magic.prefix ? affixPacketId(magic.prefix, 'magic prefix') : 0
    magicSuffixId = magic.suffix ? affixPacketId(magic.suffix, 'magic suffix') : 0
  }

  let rareName1: number | undefined
  let rareName2: number | undefined
  let rareAffixes: number[] | undefined
  const rare = item.rolledRareAffixes as GeneratedRareAffixes | undefined
  if ((quality === ItemQuality.RARE || quality === ItemQuality.CRAFTED) && rare) {
    if (!rare.rarePrefix || !rare.rareSuffix) {
      throw new Error(`domainItemToItemData113c: rare '${code}' has no RarePrefix/RareSuffix name`)
    }
    const suffixCount = tables.rareNames.suffixes.length
    rareName1 = suffixCount + rare.rarePrefix.index + 1
    rareName2 = rare.rareSuffix.index + 1
    rareAffixes = [0, 0, 0, 0, 0, 0]
    rare.prefixes.slice(0, 3).forEach((p, i) => {
      rareAffixes![i * 2] = affixPacketId(p, 'rare prefix')
    })
    rare.suffixes.slice(0, 3).forEach((s, i) => {
      rareAffixes![i * 2 + 1] = affixPacketId(s, 'rare suffix')
    })
  }

  let uniqueItemId: number | undefined
  if (quality === ItemQuality.UNIQUE) {
    const def = item.uniqueItemDef as { readonly id?: number } | undefined
    if (typeof def?.id !== 'number') throw new Error(`domainItemToItemData113c: unique '${code}' has no UniqueItems.txt row`)
    uniqueItemId = def.id
  }
  let setItemId: number | undefined
  if (quality === ItemQuality.SET) {
    const def = item.setItemDef as { readonly id?: number } | undefined
    if (typeof def?.id !== 'number') throw new Error(`domainItemToItemData113c: set '${code}' has no SetItems.txt row`)
    setItemId = def.id
  }

  let defense: number | undefined
  // Gamble previews are code-only records (flag 0x02000000): no defense until the purchase reveals the item.
  // Wire `ItemData.defense` carries the unscaled base defense (`maxac + 1` if `ac% > 0`, after `1.5x` ethereal)
  // so client `onlineItemDataToUiInventoryItem` and server `computePlayerBaseDefense` apply `(100 + ac%) / 100` once (#1911).
  if (item.base.kind === 'armor' && !isGambleMystery) {
    if (typeof item.defense !== 'number') {
      throw new Error(`domainItemToItemData113c: armor '${code}' has no rolled defense (call finalizeDroppedItem113c)`)
    }
    defense = extras.wireBaseDefense ?? extras.rolledBaseDefense ?? item.defense
  }

  const isRuneword = Boolean(extras.runeword ?? item.flags?.runeword)
  const setDef =
    quality === ItemQuality.SET
      ? ((item.setItemDef as SetItem | undefined) ??
        (setItemId !== undefined ? tables.sets.items.getById(setItemId) : undefined))
      : undefined
  const setBonusStats: SetBonusStatList[] =
    isGambleMystery || quality !== ItemQuality.SET
      ? []
      : buildSetBonusStatLists113c(extras, setDef, code)
  const runewordStats: ItemStat[] = isGambleMystery
    ? []
    : Array.isArray(extras.runewordStats)
      ? [...extras.runewordStats]
      : extras.rolledRunewordProps
        ? toWireStats(extras.rolledRunewordProps, code)
        : []

  const rawFlags =
    (identified ? ITEM_FLAG_IDENTIFIED : 0) |
    (totalSockets > 0 ? ITEM_FLAG_SOCKETED : 0) |
    (ethereal ? ITEM_FLAG_ETHEREAL : 0) |
    (personalized ? 0x01000000 : 0) |
    (isRuneword ? 0x04000000 : 0) |
    (simple ? ITEM_FLAG_COMPACT : 0) |
    (isGambleMystery ? ITEM_FLAG_SIMPLE_EXTENDED : 0)

  const autoAffixId = extras.rolledAutoMagic?.id

  return {
    id: options.unitId,
    itemId: options.unitId,
    opcode: 0x9c,
    action: 0,
    category: 0,
    ownerId: 0,
    flags: rawFlags >>> 0,
    rawFlags: rawFlags >>> 0,
    version: item.version ?? 0x65,
    location: 0,
    container: 'ground',
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
    code,
    rawCode: code.padEnd(4, ' ').slice(0, 4),
    compact: simple,
    simple,
    identified,
    socketed: totalSockets > 0,
    ethereal,
    runeword: isRuneword,
    ...(extras.runewordId !== undefined
      ? {
          runewordId: extras.runewordId,
          runewordData: 0x5000 | ((extras.runewordId + 27) & 0xfff),
        }
      : {}),
    personalized,
    ...(personalizedName !== undefined ? { personalizedName, earOrPersonalizedName: personalizedName } : {}),
    isEar: false,
    newItem: false,
    starterItem: false,
    broken: false,
    inSocket: false,
    equipped: false,
    ...(isGambleMystery ? { isGambleMystery: true } : {}),
    socketedChildCount: 0,
    usedSockets: 0,
    totalSockets,
    ...(item.uniqueId !== undefined ? { guid: item.uniqueId >>> 0 } : {}),
    ilvl: item.ilvl ?? item.level,
    quality,
    ...(autoAffixId !== undefined ? { autoAffixId } : {}),
    ...(item.qualitySubtype !== undefined ? { qualitySubtype: item.qualitySubtype } : {}),
    ...(magicPrefixId !== undefined ? { magicPrefixId } : {}),
    ...(magicSuffixId !== undefined ? { magicSuffixId } : {}),
    ...(setItemId !== undefined ? { setItemId } : {}),
    ...(uniqueItemId !== undefined ? { uniqueItemId } : {}),
    ...(rareName1 !== undefined ? { rareName1 } : {}),
    ...(rareName2 !== undefined ? { rareName2 } : {}),
    ...(rareAffixes !== undefined ? { rareAffixes } : {}),
    ...(defense !== undefined ? { defense } : {}),
    ...(item.maxDurability !== undefined ? { maxDurability: item.maxDurability } : {}),
    ...(item.durability !== undefined ? { durability: item.durability, curDurability: item.durability } : {}),
    ...(quantity !== undefined ? { quantity } : {}),
    ...(isGold ? { goldAmount: item.stack } : {}),
    invWidth: item.invWidth,
    invHeight: item.invHeight,
    stats: isGambleMystery ? [] : toWireStats(item.rolledProps, code),
    setBonusStats,
    runewordStats,
  }
}

/**
 * Finishes a drop-pipeline `Item` the way item creation does before it is sent: armor gets its rolled
 * defense from the item's own seed (`dwInitSeed`), using the same 1.13c order as the store generator (#1911):
 * 1) `ac% > 0` sets raw base to `maxac + 1` (else `[minac..maxac]`, scaled by `75%` for Low Quality).
 * 2) Ethereal applies `floor(rawBase * 3 / 2)` BEFORE `(100 + ac%) / 100` (`wireBaseDefense`).
 * 3) Total on-item defense scales `wireBaseDefense` by `(100 + ac%) / 100` and adds flat `ac`.
 */
export function finalizeDroppedItem113c(item: Item): Item {
  if (item.base.kind !== 'armor' || typeof item.defense === 'number') return item
  const seed = item.uniqueId
  if (seed === undefined) throw new Error(`finalizeDroppedItem113c: armor '${item.base.id}' has no dwInitSeed`)
  const tier = (item.rarity ?? 'normal') as ItemQualityTier
  const acPct = item.stats['ac%'] ?? 0
  const flatAc = item.stats['ac'] ?? 0
  const isEthereal = Boolean((item as Item & { readonly ethereal?: boolean }).ethereal)
  const wireBaseDefense = rollArmorWireBaseDefense113c(
    item.base,
    tier,
    acPct,
    new D2Rng(seed >>> 0 || 1),
    isEthereal,
  )
  let computed = acPct > 0 ? Math.trunc((wireBaseDefense * (100 + acPct)) / 100) : wireBaseDefense
  if (acPct > 0 && computed === wireBaseDefense) {
    computed = wireBaseDefense + 1
  }
  const defense = computed + flatAc
  return {
    ...item,
    defense,
    wireBaseDefense,
    rolledBaseDefense: wireBaseDefense,
    stats: { ...item.stats, defense },
  } as Item
}

export interface WornServerItemLike113c {
  readonly code: string
  readonly quality?: number | undefined
  readonly ethereal?: boolean | undefined
  readonly identified?: boolean | undefined
  readonly broken?: boolean | undefined
  readonly stats?: ReadonlyMap<number, number> | undefined
  readonly socketedItems?:
    | readonly {
        readonly code: string
        readonly stats?: ReadonlyMap<number, number> | undefined
        readonly rawItemData?: { readonly stats?: readonly ItemStat[] | undefined } | undefined
      }[]
    | undefined
  readonly rawItemData?:
    | {
    readonly quality?: number | undefined
    readonly defense?: number | undefined
        readonly setItemId?: number | undefined
        readonly identified?: boolean | undefined
        readonly broken?: boolean | undefined
        readonly stats?: readonly ItemStat[] | undefined
        readonly runewordStats?: readonly ItemStat[] | undefined
        readonly setBonusStats?:
          | readonly ({ readonly index: number; readonly stats: readonly ItemStat[] } | ItemStat)[]
          | undefined
        readonly socketedItems?:
          | readonly { readonly code: string; readonly stats?: readonly ItemStat[] | undefined }[]
          | undefined
      }
    | undefined
}

/**
 * Computes per-set equipped sibling bitmasks (`ITEMS_GetSetItemsMask`) in `SetItems.txt` member order (#1910).
 */
/**
 * Resolves the slot-specific `ItemStat[]` contributed by a socketed Gem, Rune, or Jewel
 * when placed inside `hostCode` (`0 = weaponMods`, `1 = helmMods`, `2 = shieldMods`).
 */
export function resolveGemSocketItemStats113c(
  filler: Pick<ItemData, 'code' | 'stats'>,
  hostCode: string,
  tables: DropTables = getEmbeddedDropTables(),
): ItemStat[] {
  const cleanHost = hostCode.trim()
  const base = tables.getBase(cleanHost)
  const applyType = base
    ? resolveGemApplyType(base)
    : resolveGemApplyType({ code: cleanHost } as unknown as ItemBase)
  if (applyType === -1) return []

  const subCode = filler.code.trim().toLowerCase()
  const gemDef = CANONICAL_GEMS_TABLE.get(subCode)
  if (gemDef) {
    const mods: readonly GemModifier[] =
      applyType === 0
        ? gemDef.weaponMods
        : applyType === 1
          ? gemDef.helmMods
          : gemDef.shieldMods
    const props: RolledItemProp[] = mods
      .filter((m) => m.code.trim().toLowerCase() !== 'ethereal')
      .map((m) => ({
        code: m.code.trim(),
        ...(m.param !== undefined ? { param: m.param } : {}),
        min: m.min,
        max: m.max,
        value: m.min,
      }))
    return rolledPropsToItemStats(props, { baseCode: cleanHost }).map((s) => ({
      statId: s.statId as number,
      param: s.param ?? 0,
      value: s.value,
    }))
  }

  return (filler.stats ?? []).map((s) => ({
    statId: s.statId,
    param: s.param ?? 0,
    value: s.value,
  }))
}

export function computeWornSetSiblingMasks113c(
  worn: readonly WornServerItemLike113c[],
  setItemsTable: SetItemTable,
): Map<string, number> {
  const masks = new Map<string, number>()
  for (const item of worn) {
    if (item.broken === true || item.rawItemData?.broken === true) continue
    const setId = item.rawItemData?.setItemId
    if (setId === undefined || setId < 0 || setId === 0xfff) continue
    const setItem = setItemsTable.getById(setId)
    if (!setItem) continue
    const members = setItemsTable.getBySet(setItem.set)
    const pos = members.findIndex((m) => m.id === setItem.id)
    if (pos >= 0) {
      masks.set(setItem.set, (masks.get(setItem.set) ?? 0) | (1 << pos))
    }
  }
  return masks
}

/**
 * Evaluates whether `SetBonusStatList` slot `listIndex` (`0..4`) on `setItem` is active (#1910):
 * - `addFunc === 0`: unconditional at `1+` pieces (`Civerb's Cudgel`, `Trang-Oul's Claws`).
 * - `addFunc === 1`: specific sibling partner bitmask (`D2Common.#10996` `0x6FD961F3..0x6FD96248`).
 * - `addFunc === 2`: total distinct set piece count (`listIndex <= wornCount - 2`).
 */
export function isSetBonusSlotActive113c(
  setItem: SetItem,
  listIndex: number,
  wornCount: number,
  siblingMask: number,
  setItemsTable: SetItemTable,
): boolean {
  if (!setItem.addFunc || setItem.addFunc === 0) return true
  if (setItem.addFunc === 2) return listIndex <= wornCount - 2
  if (setItem.addFunc === 1) {
    if (listIndex < 0 || listIndex >= 5) return false
    const members = setItemsTable.getBySet(setItem.set)
    const myPos = members.findIndex((m) => m.id === setItem.id)
    const partnerPos = myPos >= 0 && listIndex >= myPos ? listIndex + 1 : listIndex
    return (siblingMask & (1 << partnerPos)) !== 0
  }
  return false
}

/**
 * Deterministic hash-mixed `D2Rng` for rolling variable `min..max` `Sets.txt` / fallback `SetItems.txt`
 * properties without corrupting `NON_RANDOM_RANGE_CODES` (`gethit-skill`, `dmg-cold`, etc.) (#1910).
 */
export function makeDeterministicSetBonusRng113c(gameSeed: number, key: string): D2Rng {
  let h = (gameSeed ^ 0x811c9dc5) >>> 0
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 0x01000193) >>> 0
  }
  return new D2Rng(h || 1)
}

export { rollSetBonusPropIfNeeded }

/**
 * Computes a single equipped armor piece's local defense (`baseAc` scaled by on-piece `stat 16`
 * `item_armor_percent` from own stats, `runewordStats`, socketed runes/jewels, and active green set
 * bonuses), excluding flat `+Defense` (`stat 31`), which `sumPlayerItemStat(..., 31)` adds (#1911).
 */
export function computeEquippedArmorPieceDefense113c(
  item: WornServerItemLike113c,
  fallbackArmorMeta: { readonly minAc: number; readonly maxAc: number } | undefined,
  options?: {
    readonly wornCount?: number | undefined
    readonly siblingMask?: number | undefined
    readonly setItemsTable?: SetItemTable | undefined
  },
): number {
  const hasRawDefense = typeof item.rawItemData?.defense === 'number'
  if (!hasRawDefense && (fallbackArmorMeta === undefined || fallbackArmorMeta.minAc <= 0)) {
    return 0
  }

  let pieceAcPct = 0
  if (item.rawItemData !== undefined) {
    let foundRaw16 = false
    for (const st of item.rawItemData.stats ?? []) {
      if (st.statId === 16) {
        pieceAcPct += st.value
        foundRaw16 = true
      }
    }
    for (const st of item.rawItemData.runewordStats ?? []) {
      if (st.statId === 16) {
        pieceAcPct += st.value
        foundRaw16 = true
      }
    }
    if (item.socketedItems && item.socketedItems.length > 0) {
      for (const child of item.socketedItems) {
        const childStats =
          child.rawItemData?.stats ??
          (child.stats
            ? Array.from(child.stats.entries()).map(([statId, value]) => ({ statId, param: 0, value }))
            : [])
        for (const st of resolveGemSocketItemStats113c({ code: child.code, stats: childStats }, item.code)) {
          if (st.statId === 16) {
            pieceAcPct += st.value
            foundRaw16 = true
          }
        }
      }
    } else if (item.rawItemData.socketedItems && item.rawItemData.socketedItems.length > 0) {
      for (const child of item.rawItemData.socketedItems) {
        for (const st of resolveGemSocketItemStats113c(
          { code: child.code, stats: child.stats ?? [] },
          item.code,
        )) {
          if (st.statId === 16) {
            pieceAcPct += st.value
            foundRaw16 = true
          }
        }
      }
    }
    if (!foundRaw16 && item.stats?.has(16)) {
      pieceAcPct += item.stats.get(16) ?? 0
    }
    const setId = item.rawItemData.setItemId
    const storedLists = item.rawItemData.setBonusStats
    if (
      setId !== undefined &&
      setId >= 0 &&
      setId !== 0xfff &&
      Array.isArray(storedLists) &&
      storedLists.length > 0 &&
      options?.setItemsTable
    ) {
      const setItem = options.setItemsTable.getById(setId)
      if (setItem) {
        const wornCount = options.wornCount ?? 1
        const siblingMask = options.siblingMask ?? 0
        for (const listOrStat of storedLists) {
          if ('stats' in listOrStat && Array.isArray(listOrStat.stats)) {
            if (!isSetBonusSlotActive113c(setItem, listOrStat.index, wornCount, siblingMask, options.setItemsTable)) {
              continue
            }
            for (const st of listOrStat.stats) {
              if (st.statId === 16) pieceAcPct += st.value
            }
          } else if ('statId' in listOrStat && listOrStat.statId === 16) {
            pieceAcPct += listOrStat.value
          }
        }
      }
    }
  } else {
    pieceAcPct += item.stats?.get(16) ?? 0
    if (item.socketedItems && item.socketedItems.length > 0) {
      for (const child of item.socketedItems) {
        const childStats =
          child.rawItemData?.stats ??
          (child.stats
            ? Array.from(child.stats.entries()).map(([statId, value]) => ({ statId, param: 0, value }))
            : [])
        for (const st of resolveGemSocketItemStats113c({ code: child.code, stats: childStats }, item.code)) {
          if (st.statId === 16) pieceAcPct += st.value
        }
      }
    }
  }

  let baseAc: number
  if (hasRawDefense) {
    baseAc = item.rawItemData!.defense!
  } else {
    const isLowQuality = item.quality === 1 || item.rawItemData?.quality === 1
    let raw = pieceAcPct > 0 ? fallbackArmorMeta!.maxAc + 1 : fallbackArmorMeta!.minAc
    if (isLowQuality) raw = Math.max(1, Math.trunc((raw * 75) / 100))
    baseAc = item.ethereal ? Math.floor((raw * 3) / 2) : raw
  }

  if (pieceAcPct > 0) {
    let scaled = Math.trunc((baseAc * (100 + pieceAcPct)) / 100)
    if (scaled === baseAc) scaled = baseAc + 1
    return scaled
  }
  if (pieceAcPct < 0) {
    return Math.max(0, Math.trunc((baseAc * Math.max(0, 100 + pieceAcPct)) / 100))
  }
  return baseAc
}

/**
 * Objects.txt `OperateFn` values whose D2Game.dll operate function (table 0x6fd27bb8) drops from the
 * container chest TC (0x6fc8b570, quality 0) when the object is operated in mode 0, with the chance
 * (out of 100) of one drop roll:
 *
 * - 1 casket (0x6fc8ef40): unconditional.
 * - 3 urn / basket / body (0x6fc8ecd0): `rand(100) <= 20`.
 * - 4 chest (0x6fc8f040): unlocked, non-sparkling chest drops unless `rand(100) < 25`.
 * - 5 barrel (0x6fc8d7b0): `rand(100) <= 20`.
 * - 14 crate / corpse / hidden stash (0x6fc8ec20): unconditional.
 * - 48 trapped soul (0x6fc8ce10): `rand(100) < 90`.
 * - 68 evil urn (0x6fc8edb0): unconditional.
 *
 * Locked (`+0x80` object flag, two rolls) and sparkling chests (forced magic/rare quality) are runtime
 * object states set by the InitFn path, which `GameInstance` objects do not carry yet.
 */
export const CONTAINER_OPERATE_DROP_CHANCE_113C: Readonly<Record<number, number>> = Object.freeze({
  1: 100,
  3: 21,
  4: 75,
  5: 21,
  14: 100,
  48: 90,
  58: 100,
  68: 100,
})

/** D2Game.dll 0x6fd1bd8c: per act, the first and last Levels.txt Id whose monster levels bound the chest tiers. */
const CHEST_ACT_LEVEL_RANGE_113C: readonly (readonly [number, number])[] = [
  [2, 37],
  [41, 73],
  [76, 102],
  [104, 108],
  [109, 136],
]

export interface ChestDropContext113c {
  readonly tcName: string
  /** Level monster level of the container's level; the drop level of the roll. */
  readonly monsterLevel: number
}

/**
 * D2Game.dll 0x6fc8b570: the chest treasure class of a container in `levelId`.
 *
 * `mlvl` = level monster level; `first`/`last` = monster levels of the act's bounding levels;
 * `third = (|last - first| + 1) / 3`; tier A when `mlvl < first + third`, C when `mlvl >= first + 2*third`,
 * else B; the TC is `Act {act+1}[ (N)| (H)] Chest {A|B|C}` (import 0x6fc2b150 with difficulty, act, tier).
 */
export function resolveChestDropContext113c(
  levelId: number,
  difficulty: 0 | 1 | 2,
  expansion = true,
): ChestDropContext113c {
  const act = getLevelsMonLvlRecord113c(levelId).act
  const range = CHEST_ACT_LEVEL_RANGE_113C[act]
  if (!range) throw new Error(`resolveChestDropContext113c: level ${String(levelId)} has act ${String(act)}`)
  const mlvl = getLevelMonsterLevel113c(levelId, difficulty, expansion)
  const first = getLevelMonsterLevel113c(range[0], difficulty, expansion)
  const last = getLevelMonsterLevel113c(range[1], difficulty, expansion)
  const third = Math.trunc((Math.abs(last - first) + 1) / 3)
  const tier = mlvl < first + third ? 0 : mlvl >= first + third * 2 ? 2 : 1
  const diffTag = difficulty === 1 ? ' (N)' : difficulty === 2 ? ' (H)' : ''
  return { tcName: `Act ${String(act + 1)}${diffTag} Chest ${'ABC'[tier]!}`, monsterLevel: mlvl }
}
