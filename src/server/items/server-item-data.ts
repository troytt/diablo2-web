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

import { ItemQuality, type Item, type RolledItemProp } from '../../common/items/items.ts'
import type { ItemQualityTier } from '../../common/items/item-ratio.ts'
import { rolledPropsToItemStats } from '../../common/items/item-bridge.ts'
import type { GeneratedAffixes, GeneratedRareAffixes, RolledAffix } from '../../common/items/affix-generator.ts'
import type { RolledAutoMagic } from '../../common/items/automagic.ts'
import type { DropTables } from '../../common/items/drop-tables.ts'
import { rollArmorDefense113c } from '../../common/items/vendor-generator.ts'
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
} from '../../netproto/index.ts'

/** The `Item` fields the canonical generators attach beyond the declared interface. */
interface GeneratedItemExtras {
  readonly identified?: boolean | undefined
  readonly ethereal?: boolean | undefined
  readonly sockets?: number | undefined
  readonly rolledAutoMagic?: RolledAutoMagic | undefined
  readonly isGambleMystery?: boolean | undefined
  readonly personalized?: boolean | undefined
  readonly personalizedName?: string | undefined
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

function toWireStats(props: readonly RolledItemProp[] | undefined): ItemStat[] {
  return rolledPropsToItemStats(props).map((s) => {
    if (typeof s.statId !== 'number') throw new Error('domainItemToItemData113c: rolled property without an ItemStatCost id')
    return { statId: s.statId, param: s.param ?? 0, value: s.value }
  })
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
  if (item.base.kind === 'armor' && !isGambleMystery) {
    if (typeof item.defense !== 'number') {
      throw new Error(`domainItemToItemData113c: armor '${code}' has no rolled defense (call finalizeDroppedItem113c)`)
    }
    defense = item.defense
  }

  const rawFlags =
    (identified ? ITEM_FLAG_IDENTIFIED : 0) |
    (totalSockets > 0 ? ITEM_FLAG_SOCKETED : 0) |
    (ethereal ? ITEM_FLAG_ETHEREAL : 0) |
    (personalized ? 0x01000000 : 0) |
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
    runeword: false,
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
    stats: isGambleMystery ? [] : toWireStats(item.rolledProps),
    setBonusStats: [],
    runewordStats: [],
  }
}

/**
 * Finishes a drop-pipeline `Item` the way item creation does before it is sent: armor gets its rolled
 * defense from the item's own seed (`dwInitSeed`), using the same roll as the store generator.
 */
export function finalizeDroppedItem113c(item: Item): Item {
  if (item.base.kind !== 'armor' || typeof item.defense === 'number') return item
  const seed = item.uniqueId
  if (seed === undefined) throw new Error(`finalizeDroppedItem113c: armor '${item.base.id}' has no dwInitSeed`)
  const tier = (item.rarity ?? 'normal') as ItemQualityTier
  const rolled = rollArmorDefense113c(item.base, tier, item.stats['ac%'] ?? 0, new D2Rng(seed >>> 0 || 1))
  // 1.13c ethereal armor defense bonus: +50% of the rolled base defense (integer).
  const isEthereal = Boolean((item as Item & { readonly ethereal?: boolean }).ethereal)
  const defense = isEthereal ? Math.max(1, Math.floor(rolled * 1.5)) : rolled
  return { ...item, defense, stats: { ...item.stats, defense } }
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
