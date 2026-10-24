/**
 * Diablo II v1.13c Runeword & Socketing Engine (`D2Common.dll` / `D2Game.dll`).
 *
 * Implements:
 * 1. `resolveGemApplyType`: Authentic `ITEMS_GetGemApplyType` dispatch
 *    (`0 = weapon`, `1 = helm/torso`, `2 = shield/paladin shield/necromancer head`).
 * 2. `canSocketItem` & `socketItemWithSubItem` / `socketUiInventoryItem`:
 *    - Validates target sockets, identification, equipment category, and sub-item socketability
 *      (33 Runes `r01..r33`, 35 Gems `gcv..skz`, and Jewels `jew`).
 *    - Applies slot-specific `GemModifier`s from `CANONICAL_GEMS_TABLE` (`Gems.txt`) or Jewel `rolledProps`.
 *    - Evaluates `checkRunewordMatch` (`Runes.txt`) when the final socket is filled on a
 *      Low / Normal / Superior base item where all socketed items are Runes.
 *    - Rolls `T1Code1..7` within `[T1Min, T1Max]` using deterministic `Rng`, sets `ItemFlag.RUNEWORD`,
 *      combines `(baseProps + socketedMods + runewordProps)`, and updates tooltip & `UiInventoryItem`.
 * 3. `transmuteCubeItems`:
 *    - 1.13c Unsocketing Recipe: `1x Hel Rune (r15) + 1x Scroll of Town Portal (tsc) + 1x Socketed Item`
 *      -> destroys socketed items + reagents, restores clean socketed base item.
 *    - 1.13c Normal Base Socketing Recipes (`CubeMain.txt`):
 *      - `Ral + Amn + Perfect Amethyst + Normal Weapon` -> 1..6 sockets (clamped to `getMaxSockets`)
 *      - `Tal + Thul + Perfect Topaz + Normal Body Armor` -> 1..4 sockets (with 1.13c ethereal armor defense bonus)
 *      - `Ral + Thul + Perfect Sapphire + Normal Helm` -> 1..3 sockets
 *      - `Tal + Amn + Perfect Ruby + Normal Shield` -> 1..4 sockets
 *    - 1.13c Rune & Gem Upgrade Recipes (`CubeMain.txt`).
 */

import {
  ItemFlag,
  ItemMode,
  ItemQuality,
  type Item,
  type ItemBase,
  type RolledItemProp,
} from './items.ts'
import { Rng } from '../rng/d2-rng.ts'
import {
  CANONICAL_GEMS_TABLE,
  getMaxSockets,
  type GemModifier,
  type GemTable,
} from './gems.ts'
import {
  GEM_INFO,
  RUNE_INFO,
  isGemCode,
  isRuneCode,
} from './gems-data.ts'
import {
  CANONICAL_RUNES_TABLE,
  checkRunewordMatch,
  getBaseItemSocketCount,
  getItemTypeCodes,
  isNormalQuality,
  type RunewordMatchResult,
  type RunewordTable,
} from './runeword.ts'
import { getEmbeddedDropTables } from './embedded-drop-tables.ts'
import { NON_RANDOM_RANGE_CODES } from './affix-generator.ts'
import { CANONICAL_ENG_TBL_DICT } from '../data/canonical-tbl-strings.ts'
import { translateItemName, resolveBaseItemNameEn } from '../i18n/tooltip-i18n.ts'
import { itemToUiInventoryItem, onlineItemDataToUiInventoryItem } from './item-bridge.ts'
import type { GridPlacement, UiInventoryItem } from './inventory-model.ts'

/**
 * `D2Common.dll` `ITEMS_GetGemApplyType`:
 * - `0`: Weapon (`weap`, `mele`, `bow`, `miss`, `rod`, `swor`, `axe`, `pole`, `staf`, `wand`, `scep`, `orb`, `h2h`, etc.)
 * - `1`: Helm or Body Armor (`helm`, `tors`, `phlm`, `pelt`, `circ`)
 * - `2`: Shield (`shld`, `shie`, `ashd`, `head`)
 * - `-1`: Not a valid socketable equipment target
 */
export type GemApplyType = 0 | 1 | 2 | -1

/**
 * Resolves the `GemApplyType` (`0 = weapon`, `1 = helm/torso`, `2 = shield`) for an `Item` or `ItemBase`.
 */
export function resolveGemApplyType(itemOrBase: Item | ItemBase | UiInventoryItem): GemApplyType {
  const tables = getEmbeddedDropTables()
  const rawItem: Item | undefined =
    'rawItem' in itemOrBase && itemOrBase.rawItem
      ? itemOrBase.rawItem
      : 'base' in itemOrBase
        ? (itemOrBase as Item)
        : undefined

  const base: ItemBase | undefined =
    rawItem?.base ??
    ('kind' in itemOrBase && 'invWidth' in itemOrBase
      ? (itemOrBase as ItemBase)
      : 'code' in itemOrBase && typeof itemOrBase.code === 'string'
        ? tables.getBase(itemOrBase.code.trim())
        : undefined)

  const codes = new Set<string>()
  if (rawItem) {
    for (const c of getItemTypeCodes(rawItem)) {
      codes.add(c)
    }
  }
  if (base) {
    if (base.type) codes.add(base.type.trim().toLowerCase())
    if (base.type2) codes.add(base.type2.trim().toLowerCase())
    if (Array.isArray(base.tags)) {
      for (const t of base.tags) {
        if (typeof t === 'string' && t.trim()) codes.add(t.trim().toLowerCase())
      }
    }
    const lookedUp = tables.getBase(base.id.trim())
    if (lookedUp?.type) codes.add(lookedUp.type.trim().toLowerCase())
  }
  if ('code' in itemOrBase && typeof itemOrBase.code === 'string') {
    const lookedUp = tables.getBase(itemOrBase.code.trim())
    if (lookedUp?.type) codes.add(lookedUp.type.trim().toLowerCase())
  }

  // Check Shield first (since in D2 Armor.txt shields have kind='armor' and tag 'armo')
  for (const code of codes) {
    if (
      code === 'shld' ||
      code === 'shie' ||
      code === 'shield' ||
      code === 'ashd' ||
      code === 'head' ||
      tables.isA(code, 'shld') ||
      tables.isA(code, 'shie') ||
      tables.isA(code, 'ashd') ||
      tables.isA(code, 'head')
    ) {
      return 2
    }
  }

  // Check Weapon
  for (const code of codes) {
    if (
      code === 'weap' ||
      code === 'weapon' ||
      code === 'mele' ||
      code === 'swor' ||
      code === 'bow' ||
      code === 'miss' ||
      code === 'rod' ||
      tables.isA(code, 'weap') ||
      tables.isA(code, 'mele') ||
      tables.isA(code, 'bow') ||
      tables.isA(code, 'miss') ||
      tables.isA(code, 'rod')
    ) {
      return 0
    }
  }

  // Check Helm or Body Armor (Torso)
  for (const code of codes) {
    if (
      code === 'helm' ||
      code === 'helmet' ||
      code === 'tors' ||
      code === 'torso' ||
      code === 'body' ||
      code === 'phlm' ||
      code === 'pelt' ||
      code === 'circ' ||
      tables.isA(code, 'helm') ||
      tables.isA(code, 'tors') ||
      tables.isA(code, 'phlm') ||
      tables.isA(code, 'pelt') ||
      tables.isA(code, 'circ')
    ) {
      return 1
    }
  }

  if (base?.kind === 'weapon') return 0
  if (base?.kind === 'armor') {
    if (base.tags?.some(t => t === 'shld' || t === 'shie' || t === 'ashd' || t === 'head')) {
      return 2
    }
    return 1
  }

  return -1
}

/**
 * Extracts the 3-letter item code from an `Item` or `UiInventoryItem`.
 */
export function extractItemCode(item: Item | UiInventoryItem | undefined | null): string {
  if (!item) return ''
  if ('rawItem' in item && item.rawItem) {
    const raw = item.rawItem
    return (raw.code || (raw.base as any)?.code || raw.base?.id || item.code || '').trim().toLowerCase()
  }
  if ('base' in item && item.base) {
    return (item.code || (item.base as any)?.code || item.base.id || '').trim().toLowerCase()
  }
  if ('code' in item && typeof item.code === 'string') {
    return item.code.trim().toLowerCase()
  }
  return ''
}

/**
 * Checks whether `subItem` is a valid socketable filler (Rune `r01..r33`, Gem `gcv..skz`, or Jewel `jew`).
 */
export function isSocketableFiller(subItem: Item | UiInventoryItem | undefined | null): boolean {
  if (!subItem) return false
  const code = extractItemCode(subItem)
  if (!code) return false
  if (isRuneCode(code) || isGemCode(code) || Boolean(CANONICAL_GEMS_TABLE.get(code))) {
    return true
  }
  if (code === 'jew' || code === 'jewl') {
    return true
  }
  const raw: Item | undefined = 'rawItem' in subItem ? subItem.rawItem : ('base' in subItem ? subItem : undefined)
  if (raw?.base?.type === 'jewl' || raw?.base?.tags?.includes('jewl')) {
    return true
  }
  return false
}

/**
 * Returns the number of currently filled sockets on an `Item` or `UiInventoryItem`.
 */
export function getFilledSocketCount(item: Item | UiInventoryItem | undefined | null): number {
  if (!item) return 0
  const raw: Item | undefined = 'rawItem' in item ? item.rawItem : ('base' in item ? item : undefined)
  if (raw?.socketedItems) {
    return raw.socketedItems.length
  }
  if (typeof raw?.socketedCount === 'number') {
    return raw.socketedCount
  }
  return 0
}

/**
 * Returns the total socket capacity of an `Item` or `UiInventoryItem`.
 */
export function getTotalSocketCount(item: Item | UiInventoryItem | undefined | null): number {
  if (!item) return 0
  const raw: Item | undefined = 'rawItem' in item ? item.rawItem : ('base' in item ? item : undefined)
  if (raw) {
    const count = getBaseItemSocketCount(raw)
    if (count > 0) return count
  }
  if ('sockets' in item && typeof item.sockets === 'number' && item.sockets > 0) {
    return item.sockets
  }
  return 0
}

/**
 * Validates whether `subItem` (Rune, Gem, or Jewel) can be inserted into `targetItem` per 1.13c `D2Game.dll`.
 */
export function canSocketItem(
  targetItem: Item | UiInventoryItem | undefined | null,
  subItem: Item | UiInventoryItem | undefined | null,
): boolean {
  if (!targetItem || !subItem) return false
  if (!isSocketableFiller(subItem)) return false

  const totalSockets = getTotalSocketCount(targetItem)
  if (totalSockets <= 0) return false

  const filledSockets = getFilledSocketCount(targetItem)
  if (filledSockets >= totalSockets) return false

  // Target must be identified
  const rawTarget: Item | undefined =
    'rawItem' in targetItem ? targetItem.rawItem : ('base' in targetItem ? targetItem : undefined)
  if ('identified' in targetItem && targetItem.identified === false) return false
  if (rawTarget) {
    if (rawTarget.identified === false) return false
    if (rawTarget.flags && rawTarget.flags.identified === false) return false
  }

  // Target must be a valid equipment category (weapon, helm/torso, or shield)
  const applyType = resolveGemApplyType(targetItem)
  if (applyType === -1) return false

  // Sub-item if Jewel must also be identified
  if ('identified' in subItem && subItem.identified === false) return false
  const rawSub: Item | undefined =
    'rawItem' in subItem ? subItem.rawItem : ('base' in subItem ? subItem : undefined)
  if (rawSub && rawSub.identified === false) return false

  return true
}

/**
 * Converts a `GemModifier` from `Gems.txt` into a concrete `RolledItemProp`.
 */
export function gemModifierToRolledProp(mod: GemModifier): RolledItemProp {
  const code = mod.code.trim()
  return {
    code,
    ...(mod.param !== undefined ? { param: mod.param } : {}),
    min: mod.min,
    max: mod.max,
    value: mod.min,
  }
}

/**
 * Resolves the concrete `RolledItemProp[]` contributed by a single socketed sub-item
 * when inserted into `targetItem` (`GemApplyType` `0`, `1`, or `2`).
 */
export function getSocketedSubItemProps(
  targetItem: Item | ItemBase | UiInventoryItem,
  subItem: Item | UiInventoryItem,
  gemTable: GemTable = CANONICAL_GEMS_TABLE,
): RolledItemProp[] {
  const applyType = resolveGemApplyType(targetItem)
  if (applyType === -1) return []

  const subCode = extractItemCode(subItem)
  const gemDef = gemTable.get(subCode)
  if (gemDef) {
    const mods =
      applyType === 0
        ? gemDef.weaponMods
        : applyType === 1
          ? gemDef.helmMods
          : gemDef.shieldMods
    return mods.map(gemModifierToRolledProp)
  }

  // Jewel ('jew'): copy its rolledProps
  const rawSub: Item | undefined =
    'rawItem' in subItem ? subItem.rawItem : ('base' in subItem ? subItem : undefined)
  if (rawSub?.rolledProps && rawSub.rolledProps.length > 0) {
    return rawSub.rolledProps.map(p => ({ ...p }))
  }
  return []
}

/**
 * Ensures a socketable `UiInventoryItem` or `Item` is represented as a valid `Item` instance
 * for storage in `target.socketedItems`.
 */
export function toSocketableRawItem(subItem: Item | UiInventoryItem): Item {
  if ('base' in subItem && subItem.base) {
    return {
      ...subItem,
      location: { mode: ItemMode.SOCKETED },
    }
  }
  if ('rawItem' in subItem && subItem.rawItem) {
    const raw = subItem.rawItem
    return {
      ...raw,
      ...(subItem.code || raw.code ? { code: (subItem.code || raw.code)! } : {}),
      location: { mode: ItemMode.SOCKETED },
    }
  }
  const code = (subItem.code ?? '').trim().toLowerCase()
  const tables = getEmbeddedDropTables()
  const baseFromTable = tables.getBase(code)
  const runeInfo = RUNE_INFO[code]
  const gemInfo = GEM_INFO[code]
  const nameEn = runeInfo?.nameEn ?? gemInfo?.nameEn ?? subItem.name ?? code
  const nameZh = runeInfo ? `${runeInfo.nameZh}符文` : (gemInfo?.nameZh ?? subItem.nameZh ?? nameEn)
  const subReqLevel = 'reqLevel' in subItem ? subItem.reqLevel : undefined
  const reqLevel = runeInfo?.reqLevel ?? gemInfo?.reqLevel ?? subReqLevel ?? 1

  const base: ItemBase = baseFromTable ?? {
    id: code,
    name: nameEn,
    kind: 'misc',
    invWidth: 1,
    invHeight: 1,
    maxStack: 1,
    value: 100,
    damage: 0,
    defense: 0,
    tags: [isRuneCode(code) ? 'rune' : isGemCode(code) ? 'gem' : 'jewl'],
    level: reqLevel,
    type: isRuneCode(code) ? 'rune' : isGemCode(code) ? 'gem' : 'jewl',
  }

  return {
    base,
    prefix: null,
    suffix: null,
    level: reqLevel,
    ilvl: reqLevel,
    name: nameEn,
    nameZh,
    stats: {},
    invWidth: 1,
    invHeight: 1,
    stack: 1,
    value: base.value,
    code,
    quality: ItemQuality.NORMAL,
    rarity: isRuneCode(code) ? 'rune' : 'normal',
    identified: true,
    location: { mode: ItemMode.SOCKETED },
  }
}

export interface SocketOperationResult {
  readonly success: boolean
  readonly item: Item
  readonly uiItem: UiInventoryItem
  readonly runewordMatch?: RunewordMatchResult | undefined
  readonly reason?: string | undefined
}

/**
 * Recalculates an item's effective `defense` and `stats` record from its `base` and `rolledProps`.
 */
function recomputeItemStats(
  baseItem: Item,
  rolledProps: readonly RolledItemProp[],
): {
  readonly defense: number | undefined
  readonly stats: Record<string, number>
} {
  let totalEdPct = 0
  let flatMinDmg = 0
  let flatMaxDmg = 0
  let totalAcPct = 0
  let flatAc = 0
  let indestruct = 0

  for (const p of rolledProps) {
    const c = (p.code || '').trim().toLowerCase()
    if (c === 'dmg%') totalEdPct += p.value
    else if (c === 'dmg-min') flatMinDmg += p.value
    else if (c === 'dmg-max') flatMaxDmg += p.value
    else if (c === 'dmg-norm') {
      flatMinDmg += p.min > 0 ? p.min : p.value
      flatMaxDmg += p.max > 0 ? p.max : p.value
    } else if (c === 'dmg') {
      flatMinDmg += p.value
      flatMaxDmg += p.value
    } else if (c === 'ac%') totalAcPct += p.value
    else if (c === 'ac') flatAc += p.value
    else if (c === 'indestruct') indestruct = 1
  }

  const isEth = Boolean(
    baseItem.flags?.ethereal ||
      (baseItem as any).ethereal ||
      baseItem.stats?.ethereal,
  )
  const isLow = baseItem.quality === ItemQuality.LOW || baseItem.rarity === 'low'

  const rawBaseDef = baseItem.base.defense > 0 ? baseItem.base.defense : 0
  let finalDef: number | undefined = baseItem.defense
  if (rawBaseDef > 0) {
    let effectiveBaseDef = rawBaseDef
    if (isLow) {
      effectiveBaseDef = Math.max(1, Math.floor(effectiveBaseDef * 0.75))
    }
    if (isEth) {
      effectiveBaseDef = Math.floor(effectiveBaseDef * 1.5)
    }
    // If the item had ebugged base defense stored in base.defense, it's already in rawBaseDef
    let computed = Math.floor((effectiveBaseDef * (100 + totalAcPct)) / 100) + flatAc
    if (totalAcPct > 0 && computed === effectiveBaseDef) {
      computed = effectiveBaseDef + 1
    }
    finalDef = computed
  }

  const nextStats: Record<string, number> = {
    ...baseItem.stats,
  }
  if (finalDef !== undefined) {
    nextStats.defense = finalDef
  }
  if (baseItem.base.damage > 0) {
    let effDmg = baseItem.base.damage
    if (isLow) effDmg = Math.max(1, Math.floor(effDmg * 0.75))
    if (isEth) effDmg = Math.floor(effDmg * 1.5)
    nextStats.damage = Math.floor((effDmg * (100 + totalEdPct)) / 100) + Math.floor((flatMinDmg + flatMaxDmg) / 2)
  }
  if (indestruct) {
    nextStats.indestruct = 1
  }

  return { defense: finalDef, stats: nextStats }
}

/**
 * Ensures a target `Item | UiInventoryItem` has a concrete underlying `Item` instance.
 */
function ensureTargetRawItem(targetInput: Item | UiInventoryItem): Item | undefined {
  if ('rawItem' in targetInput && targetInput.rawItem) {
    return targetInput.rawItem
  }
  if ('base' in targetInput && targetInput.base) {
    return targetInput as Item
  }
  if ('code' in targetInput && typeof targetInput.code === 'string') {
    const code = targetInput.code.trim()
    const tables = getEmbeddedDropTables()
    const base = tables.getBase(code)
    if (!base) return undefined
    const uiTarget = targetInput as UiInventoryItem
    const sockets = uiTarget.sockets ?? 0
    const qualityMap: Record<string, ItemQuality> = {
      normal: ItemQuality.NORMAL,
      magic: ItemQuality.MAGIC,
      rare: ItemQuality.RARE,
      set: ItemQuality.SET,
      unique: ItemQuality.UNIQUE,
      craft: ItemQuality.CRAFTED,
      rune: ItemQuality.NORMAL,
    }
    const q = qualityMap[String(uiTarget.quality ?? 'normal')] ?? ItemQuality.NORMAL
    return createSocketedBaseItem(code, sockets, {
      ilvl: Math.max(1, uiTarget.reqLevel ?? base.level ?? 25),
      quality: q,
      ethereal: Boolean(uiTarget.ethereal),
    })
  }
  return undefined
}

function toUiItemWithId(item: Item, uiId?: string): UiInventoryItem {
  const ui = itemToUiInventoryItem(item, getEmbeddedDropTables())
  return uiId ? { ...ui, id: uiId } : ui
}

let cubeItemSeqCounter = 0

export function resetCubeItemSeqCounter(): void {
  cubeItemSeqCounter = 0
}

export function socketItemWithSubItem(
  targetInput: Item | UiInventoryItem,
  subInput: Item | UiInventoryItem,
  rng: Rng = new Rng(0x113c5eed),
  options?: {
    readonly runewordTable?: RunewordTable
    readonly gemTable?: GemTable
    readonly isLadder?: boolean
  },
): SocketOperationResult {
  const rawTarget: Item | undefined = ensureTargetRawItem(targetInput)

  if (!rawTarget || !canSocketItem(targetInput, subInput)) {
    const fallbackItem = rawTarget ?? toSocketableRawItem(targetInput)
    return {
      success: false,
      item: fallbackItem,
      uiItem: 'id' in targetInput && 'allowedSlots' in targetInput
        ? targetInput
        : toUiItemWithId(fallbackItem),
      reason: 'Target item cannot accept this socketable item',
    }
  }

  const totalSockets = getTotalSocketCount(targetInput)
  const existingSocketed = rawTarget.socketedItems ?? []

  // Snapshot the clean unsocketed base item before the very first insertion
  const unsocketedSnapshot: Item =
    (rawTarget as any).unsocketedSnapshot ??
    ({
      ...rawTarget,
      socketedItems: [],
      socketedCount: 0,
      runeword: undefined,
      flags: {
        ...rawTarget.flags,
        socketed: true,
        runeword: false,
      },
      rawFlags: (((rawTarget.rawFlags ?? 0) | ItemFlag.SOCKETED) & ~ItemFlag.RUNEWORD) >>> 0,
    } as Item)

  const baseRolledProps: readonly RolledItemProp[] =
    (rawTarget as any).baseRolledProps ?? (rawTarget.rolledProps ? [...rawTarget.rolledProps] : [])

  const subRaw = toSocketableRawItem(subInput)
  const nextSocketedItems: Item[] = [...existingSocketed, subRaw]

  const gemTable = options?.gemTable ?? CANONICAL_GEMS_TABLE
  const socketedMods: RolledItemProp[] = []
  for (const sockItem of nextSocketedItems) {
    socketedMods.push(...getSocketedSubItemProps(unsocketedSnapshot, sockItem, gemTable))
  }

  const tables = getEmbeddedDropTables()
  const allRunes = nextSocketedItems.every(s => isRuneCode(extractItemCode(s)))
  const runeCodes = nextSocketedItems.map(s => extractItemCode(s))

  // Check for Runeword completion when the final socket is filled with Runes on a Normal/Superior/Low base
  let runewordMatch: RunewordMatchResult | undefined
  if (
    nextSocketedItems.length === totalSockets &&
    allRunes &&
    isNormalQuality(unsocketedSnapshot)
  ) {
    const baseForMatch: Item = {
      ...unsocketedSnapshot,
      totalSockets,
      stats: {
        ...unsocketedSnapshot.stats,
        sockets: totalSockets,
      },
    }
    runewordMatch = checkRunewordMatch(
      baseForMatch,
      runeCodes,
      tables.isA,
      options?.runewordTable ?? CANONICAL_RUNES_TABLE,
      { isLadder: options?.isLadder ?? true },
    )
  }

  const baseCode = (unsocketedSnapshot.code || (unsocketedSnapshot.base as any)?.code || unsocketedSnapshot.base.id || '').trim()
  const baseNameEn = resolveBaseItemNameEn(unsocketedSnapshot.base.name, baseCode)

  if (runewordMatch) {
    // Roll T1Code1..7 properties from the Runeword definition
    const rolledRunewordProps: RolledItemProp[] = []
    for (const prop of runewordMatch.t1Codes) {
      const code = prop.code.trim()
      if (!code) continue
      const isRangeCode = NON_RANDOM_RANGE_CODES.has(code.toLowerCase())
      let val: number
      if (isRangeCode) {
        val = prop.min
      } else if (prop.min === prop.max) {
        val = prop.min
      } else {
        const lo = Math.min(prop.min, prop.max)
        const hi = Math.max(prop.min, prop.max)
        val = rng.int(lo, hi)
      }
      rolledRunewordProps.push({
        code,
        ...(prop.param !== undefined ? { param: prop.param } : {}),
        min: prop.min,
        max: prop.max,
        value: val,
      })
    }

    const combinedProps: RolledItemProp[] = [
      ...baseRolledProps,
      ...socketedMods,
      ...rolledRunewordProps,
    ]

    const rwEn = (CANONICAL_ENG_TBL_DICT[runewordMatch.name] ?? runewordMatch.runeName).trim()
    const rwZh = translateItemName(runewordMatch.name) || translateItemName(rwEn) || rwEn
    const recomputed = recomputeItemStats(unsocketedSnapshot, combinedProps)

    const completedItem: Item = {
      ...unsocketedSnapshot,
      name: rwEn,
      nameZh: rwZh,
      rarity: 'runeword',
      quality: unsocketedSnapshot.quality ?? ItemQuality.NORMAL,
      totalSockets,
      socketedCount: nextSocketedItems.length,
      socketedItems: nextSocketedItems,
      rolledProps: combinedProps,
      defense: recomputed.defense,
      stats: {
        ...recomputed.stats,
        sockets: totalSockets,
      },
      flags: {
        ...unsocketedSnapshot.flags,
        identified: true,
        socketed: true,
        runeword: true,
      },
      rawFlags:
        (((unsocketedSnapshot.rawFlags ?? 0) |
          ItemFlag.IDENTIFIED |
          ItemFlag.SOCKETED |
          ItemFlag.RUNEWORD) >>>
          0),
      runeword: {
        id: runewordMatch.runewordId,
        ...( {
          name: runewordMatch.name,
          runeName: runewordMatch.runeName,
          runes: runewordMatch.runes,
          t1Codes: runewordMatch.t1Codes,
        } as any ),
      },
      ...({
        unsocketedSnapshot,
        baseRolledProps,
      } as any),
    }

    const uiId = 'id' in targetInput && targetInput.id !== undefined ? String(targetInput.id) : undefined
    const uiItem = toUiItemWithId(completedItem, uiId)
    return {
      success: true,
      item: completedItem,
      uiItem,
      runewordMatch,
    }
  }

  // Partial or non-Runeword socketed item ("Gemmed <BaseName>" for normal/superior/low quality)
  const combinedProps: RolledItemProp[] = [...baseRolledProps, ...socketedMods]
  const recomputed = recomputeItemStats(unsocketedSnapshot, combinedProps)
  const isNormalBase = isNormalQuality(unsocketedSnapshot)
  const gemmedNameEn = isNormalBase ? `Gemmed ${baseNameEn}` : unsocketedSnapshot.name
  const gemmedNameZh = isNormalBase ? translateItemName(gemmedNameEn) : unsocketedSnapshot.nameZh

  const updatedItem: Item = {
    ...unsocketedSnapshot,
    name: gemmedNameEn,
    ...(gemmedNameZh ? { nameZh: gemmedNameZh } : {}),
    totalSockets,
    socketedCount: nextSocketedItems.length,
    socketedItems: nextSocketedItems,
    rolledProps: combinedProps,
    defense: recomputed.defense,
    stats: {
      ...recomputed.stats,
      sockets: totalSockets,
    },
    flags: {
      ...unsocketedSnapshot.flags,
      identified: true,
      socketed: true,
      runeword: false,
    },
    rawFlags:
      ((((unsocketedSnapshot.rawFlags ?? 0) | ItemFlag.IDENTIFIED | ItemFlag.SOCKETED) &
        ~ItemFlag.RUNEWORD) >>>
        0),
    runeword: undefined,
    ...({
      unsocketedSnapshot,
      baseRolledProps,
    } as any),
  }

  const uiId = 'id' in targetInput && targetInput.id !== undefined ? String(targetInput.id) : undefined
  const uiItem = toUiItemWithId(updatedItem, uiId)
  return {
    success: true,
    item: updatedItem,
    uiItem,
  }
}

/**
 * Creates a canonical 1.13c socketed (or unsocketed) base equipment `Item` from a 3-letter item code
 * (e.g. `'crs'` Crystal Sword, `'mon'` Monarch, `'xtp'` Mage Plate, `'crn'` Crown, `'bsd'` Broad Sword, `'voul'`/ `'vou'` Voulge).
 */
export function createSocketedBaseItem(
  code: string,
  sockets: number,
  options?: {
    readonly ilvl?: number | undefined
    readonly quality?: ItemQuality | undefined
    readonly ethereal?: boolean | undefined
    readonly baseRolledProps?: readonly RolledItemProp[] | undefined
  },
): Item {
  const tables = getEmbeddedDropTables()
  const cleanCode = code.trim()
  const base = tables.getBase(cleanCode)
  if (!base) {
    throw new Error(`Unknown 1.13c base item code: ${cleanCode}`)
  }

  const ilvl = options?.ilvl ?? Math.max(1, base.level || 25)
  const quality = options?.quality ?? ItemQuality.NORMAL
  const isEth = Boolean(options?.ethereal)
  const baseNameEn = resolveBaseItemNameEn(base.name, cleanCode)
  const baseNameZh = translateItemName(baseNameEn)
  const baseRolledProps = options?.baseRolledProps ? [...options.baseRolledProps] : []

  let rawFlags = ItemFlag.IDENTIFIED
  if (sockets > 0) rawFlags |= ItemFlag.SOCKETED
  if (isEth) rawFlags |= ItemFlag.ETHEREAL

  let effDef = base.defense > 0 ? base.defense : undefined
  if (effDef !== undefined && isEth) {
    effDef = Math.floor(effDef * 1.5)
  }

  const maxDur = Number((base as any).durability) || (base.kind === 'armor' ? 40 : base.kind === 'weapon' ? 30 : 0)

  const item: Item = {
    base,
    prefix: null,
    suffix: null,
    level: ilvl,
    ilvl,
    name: quality === ItemQuality.SUPERIOR ? `Superior ${baseNameEn}` : quality === ItemQuality.LOW ? `Cracked ${baseNameEn}` : baseNameEn,
    nameZh: quality === ItemQuality.SUPERIOR ? `超强的${baseNameZh}` : quality === ItemQuality.LOW ? `碎裂的${baseNameZh}` : baseNameZh,
    stats: {
      ...(effDef !== undefined ? { defense: effDef } : {}),
      ...(base.damage > 0 ? { damage: isEth ? Math.floor(base.damage * 1.5) : base.damage } : {}),
      ...(sockets > 0 ? { sockets } : {}),
      ...(isEth ? { ethereal: 1 } : {}),
    },
    invWidth: base.invWidth,
    invHeight: base.invHeight,
    stack: 1,
    value: base.cost ?? base.value ?? 100,
    code: cleanCode,
    quality,
    rarity: quality === ItemQuality.SUPERIOR ? 'superior' : quality === ItemQuality.LOW ? 'low' : 'normal',
    identified: true,
    totalSockets: sockets > 0 ? sockets : undefined,
    socketedCount: 0,
    socketedItems: [],
    defense: effDef,
    durability: maxDur > 0 ? maxDur : undefined,
    maxDurability: maxDur > 0 ? maxDur : undefined,
    rolledProps: baseRolledProps,
    flags: {
      identified: true,
      socketed: sockets > 0,
      ethereal: isEth,
      runeword: false,
    },
    rawFlags: rawFlags >>> 0,
    ...({
      baseRolledProps,
    } as any),
  }

  return item
}

/**
 * Creates a canonical 1.13c Rune or Gem `Item` from its 3-letter code (`r01..r33` or `gcv..skz`).
 */
export function createSocketableItem(code: string): Item {
  const cleanCode = code.trim().toLowerCase()
  const tables = getEmbeddedDropTables()
  const baseFromTable = tables.getBase(cleanCode)
  const runeInfo = RUNE_INFO[cleanCode]
  const gemInfo = GEM_INFO[cleanCode]
  if (!runeInfo && !gemInfo && !baseFromTable) {
    throw new Error(`Unknown socketable item code: ${cleanCode}`)
  }

  const nameEn = runeInfo?.nameEn ?? gemInfo?.nameEn ?? baseFromTable?.name ?? cleanCode
  const nameZh = runeInfo ? `${runeInfo.nameZh}符文` : (gemInfo?.nameZh ?? translateItemName(nameEn))
  const reqLevel = runeInfo?.reqLevel ?? gemInfo?.reqLevel ?? baseFromTable?.level ?? 1

  const base: ItemBase = baseFromTable ?? {
    id: cleanCode,
    name: nameEn,
    kind: 'misc',
    invWidth: 1,
    invHeight: 1,
    maxStack: 1,
    value: 100,
    damage: 0,
    defense: 0,
    tags: [runeInfo ? 'rune' : 'gem'],
    level: reqLevel,
    type: runeInfo ? 'rune' : 'gem',
  }

  return {
    base,
    prefix: null,
    suffix: null,
    level: reqLevel,
    ilvl: reqLevel,
    name: nameEn,
    nameZh,
    stats: {},
    invWidth: 1,
    invHeight: 1,
    stack: 1,
    value: base.cost ?? base.value ?? 100,
    code: cleanCode,
    quality: ItemQuality.NORMAL,
    rarity: runeInfo ? 'rune' : 'normal',
    identified: true,
    flags: {
      identified: true,
    },
    rawFlags: ItemFlag.IDENTIFIED,
  }
}

export interface CubeTransmuteResult {
  readonly matched: boolean
  readonly recipeName?: string | undefined
  readonly resultItems: readonly GridPlacement[]
}

/**
 * Canonical 1.13c Rune upgrade required gem map (`CubeMain.txt`):
 * - `r01..r09`: 3 runes -> next rune (no gem required)
 * - `r10..r20`: 3 runes + 1 chipped/flawed gem -> next rune
 * - `r21..r32`: 2 runes + 1 flawed/normal/flawless gem -> next rune
 */
const RUNE_UPGRADE_RECIPES: Readonly<Record<number, { readonly count: number; readonly gemCode?: string }>> = {
  1: { count: 3 },
  2: { count: 3 },
  3: { count: 3 },
  4: { count: 3 },
  5: { count: 3 },
  6: { count: 3 },
  7: { count: 3 },
  8: { count: 3 },
  9: { count: 3 },
  10: { count: 3, gemCode: 'gcy' }, // 3 Thul + Chipped Topaz -> Amn
  11: { count: 3, gemCode: 'gcv' }, // 3 Amn + Chipped Amethyst -> Sol
  12: { count: 3, gemCode: 'gcb' }, // 3 Sol + Chipped Sapphire -> Shael
  13: { count: 3, gemCode: 'gcr' }, // 3 Shael + Chipped Ruby -> Dol
  14: { count: 3, gemCode: 'gcg' }, // 3 Dol + Chipped Emerald -> Hel
  15: { count: 3, gemCode: 'gcw' }, // 3 Hel + Chipped Diamond -> Io
  16: { count: 3, gemCode: 'gfy' }, // 3 Io + Flawed Topaz -> Lum
  17: { count: 3, gemCode: 'gfv' }, // 3 Lum + Flawed Amethyst -> Ko
  18: { count: 3, gemCode: 'gfb' }, // 3 Ko + Flawed Sapphire -> Fal
  19: { count: 3, gemCode: 'gfr' }, // 3 Fal + Flawed Ruby -> Lem
  20: { count: 3, gemCode: 'gfg' }, // 3 Lem + Flawed Emerald -> Pul
  21: { count: 2, gemCode: 'gfw' }, // 2 Pul + Flawed Diamond -> Um
  22: { count: 2, gemCode: 'gsy' }, // 2 Um + Topaz -> Mal
  23: { count: 2, gemCode: 'gsv' }, // 2 Mal + Amethyst -> Ist
  24: { count: 2, gemCode: 'gsb' }, // 2 Ist + Sapphire -> Gul
  25: { count: 2, gemCode: 'gsr' }, // 2 Gul + Ruby -> Vex
  26: { count: 2, gemCode: 'gsg' }, // 2 Vex + Emerald -> Ohm
  27: { count: 2, gemCode: 'gsw' }, // 2 Ohm + Diamond -> Lo
  28: { count: 2, gemCode: 'gly' }, // 2 Lo + Flawless Topaz -> Sur
  29: { count: 2, gemCode: 'gzv' }, // 2 Sur + Flawless Amethyst -> Ber
  30: { count: 2, gemCode: 'glb' }, // 2 Ber + Flawless Sapphire -> Jah
  31: { count: 2, gemCode: 'glr' }, // 2 Jah + Flawless Ruby -> Cham
  32: { count: 2, gemCode: 'glg' }, // 2 Cham + Flawless Emerald -> Zod
}

/**
 * Canonical 1.13c Gem upgrade chains (3x same gem -> 1x next tier gem).
 */
const GEM_UPGRADE_CHAINS: readonly (readonly string[])[] = [
  ['gcv', 'gfv', 'gsv', 'gzv', 'gpv'], // Amethyst
  ['gcy', 'gfy', 'gsy', 'gly', 'gpy'], // Topaz
  ['gcb', 'gfb', 'gsb', 'glb', 'gpb'], // Sapphire
  ['gcg', 'gfg', 'gsg', 'glg', 'gpg'], // Emerald
  ['gcr', 'gfr', 'gsr', 'glr', 'gpr'], // Ruby
  ['gcw', 'gfw', 'gsw', 'glw', 'gpw'], // Diamond
  ['skc', 'skf', 'sku', 'skl', 'skz'], // Skull
]

/**
 * Restores a socketed item to its clean, unsocketed-fillers state (preserving its empty sockets)
 * per 1.13c `1 Hel Rune + Scroll of Town Portal + Any Socketed Item`.
 */
export function unsocketEquipmentItem(targetUiItem: UiInventoryItem): UiInventoryItem {
  const raw = targetUiItem.rawItem
  if (!raw) return targetUiItem

  const totalSockets = getTotalSocketCount(targetUiItem)
  const snapshot: Item | undefined = (raw as any).unsocketedSnapshot
  if (snapshot) {
    const restoredRaw: Item = {
      ...snapshot,
      totalSockets,
      socketedCount: 0,
      socketedItems: [],
      runeword: undefined,
      flags: {
        ...snapshot.flags,
        identified: true,
        socketed: totalSockets > 0,
        runeword: false,
      },
      rawFlags:
        ((((snapshot.rawFlags ?? 0) | ItemFlag.IDENTIFIED | (totalSockets > 0 ? ItemFlag.SOCKETED : 0)) &
          ~ItemFlag.RUNEWORD) >>>
          0),
    }
    return toUiItemWithId(restoredRaw, targetUiItem.id)
  }

  const baseRolledProps: readonly RolledItemProp[] = (raw as any).baseRolledProps ?? []
  const baseCode = (raw.code || (raw.base as any)?.code || raw.base.id || '').trim()
  const baseNameEn = resolveBaseItemNameEn(raw.base.name, baseCode)
  const baseNameZh = translateItemName(baseNameEn)
  const recomputed = recomputeItemStats(
    {
      ...raw,
      socketedItems: [],
      socketedCount: 0,
      runeword: undefined,
    },
    baseRolledProps,
  )

  const wasRuneword = Boolean(raw.runeword || raw.flags?.runeword || raw.rarity === 'runeword')
  const restoredQuality = raw.quality ?? ItemQuality.NORMAL
  const restoredRarity = wasRuneword
    ? restoredQuality === ItemQuality.SUPERIOR
      ? 'superior'
      : restoredQuality === ItemQuality.LOW
        ? 'low'
        : 'normal'
    : raw.rarity ?? 'normal'

  const restoredRaw: Item = {
    ...raw,
    name:
      restoredRarity === 'superior'
        ? `Superior ${baseNameEn}`
        : restoredRarity === 'low'
          ? `Cracked ${baseNameEn}`
          : wasRuneword || raw.name.startsWith('Gemmed ')
            ? baseNameEn
            : raw.name,
    nameZh:
      restoredRarity === 'superior'
        ? `超强的${baseNameZh}`
        : restoredRarity === 'low'
          ? `碎裂的${baseNameZh}`
          : wasRuneword || raw.name.startsWith('Gemmed ')
            ? baseNameZh
            : raw.nameZh,
    rarity: restoredRarity,
    totalSockets,
    socketedCount: 0,
    socketedItems: [],
    rolledProps: baseRolledProps,
    defense: recomputed.defense,
    stats: {
      ...recomputed.stats,
      sockets: totalSockets,
    },
    runeword: undefined,
    flags: {
      ...raw.flags,
      identified: true,
      socketed: totalSockets > 0,
      runeword: false,
    },
    rawFlags:
      ((((raw.rawFlags ?? 0) | ItemFlag.IDENTIFIED | (totalSockets > 0 ? ItemFlag.SOCKETED : 0)) &
        ~ItemFlag.RUNEWORD) >>>
        0),
  }

  return toUiItemWithId(restoredRaw, targetUiItem.id)
}

/**
 * Evaluates and executes Horadric Cube recipes on the given `cubePlacements` (3x4 grid).
 *
 * Supported 1.13c recipes:
 * 1. **Unsocket Equipment (`CubeMain.txt`)**:
 *    `1x Hel Rune (r15) + 1x Scroll of Town Portal (tsc) + 1x Socketed Equipment (with >= 1 socketed item)`
 *    -> Destroys Hel, TP scroll, and all socketed runes/gems/jewels; returns clean socketed base item.
 * 2. **Normal Base Socketing Recipes (`CubeMain.txt`)**:
 *    - `Ral (r08) + Amn (r11) + Perfect Amethyst (gpv) + Normal Unsocketed Weapon` -> adds 1..6 sockets
 *    - `Tal (r07) + Thul (r10) + Perfect Topaz (gpy) + Normal Unsocketed Body Armor` -> adds 1..4 sockets
 *    - `Ral (r08) + Thul (r10) + Perfect Sapphire (gpb) + Normal Unsocketed Helm` -> adds 1..3 sockets
 *    - `Tal (r07) + Amn (r11) + Perfect Ruby (gpr) + Normal Unsocketed Shield` -> adds 1..4 sockets
 * 3. **Rune Upgrades (`CubeMain.txt`)**:
 *    - `3x r01..r09` -> `1x next rune`
 *    - `3x r10..r20 (+ optional chipped/flawed gem)` -> `1x next rune`
 *    - `2x r21..r32 (+ optional gem)` -> `1x next rune`
 * 4. **Gem Upgrades (`CubeMain.txt`)**:
 *    - `3x same gem (Chipped..Flawless)` -> `1x next quality gem`
 */
export function transmuteCubeItems(
  cubePlacements: readonly GridPlacement[],
  rng: Rng = new Rng(0x113c5eed),
): CubeTransmuteResult {
  if (cubePlacements.length === 0) {
    return { matched: false, resultItems: cubePlacements }
  }

  const items = cubePlacements.map(p => p.item)
  const codes = items.map(it => extractItemCode(it))

  // 0a. CubeMain.txt Row 0: `msf + vip -> hst` (Horadric Staff, Act 2 Q2)
  if (items.length === 2 && codes.includes('msf') && codes.includes('vip')) {
    const hstUi = onlineItemDataToUiInventoryItem({
      code: 'hst',
      quality: ItemQuality.UNIQUE,
      identified: true,
    })
    return {
      matched: true,
      recipeName: 'msf + vip -> hst (Horadric Staff)',
      resultItems: [{ item: hstUi, col: 0, row: 0 }],
    }
  }

  // 0b. CubeMain.txt Row 1: `qf1 + qhr + qey + qbr -> qf2` (Khalim's Will, Act 3 Q3/Q5)
  if (
    items.length === 4 &&
    codes.includes('qf1') &&
    codes.includes('qhr') &&
    codes.includes('qey') &&
    codes.includes('qbr')
  ) {
    const qf2Ui = onlineItemDataToUiInventoryItem({
      code: 'qf2',
      quality: ItemQuality.UNIQUE,
      identified: true,
    })
    return {
      matched: true,
      recipeName: "qf1 + qhr + qey + qbr -> qf2 (Khalim's Will)",
      resultItems: [{ item: qf2Ui, col: 0, row: 0 }],
    }
  }

  // 1. Check Unsocketing Recipe: 1x Hel Rune ('r15') + 1x Scroll of Town Portal ('tsc') + 1x Socketed Equipment
  if (items.length === 3) {
    const helIdx = codes.findIndex(c => c === 'r15')
    const tscIdx = codes.findIndex(c => c === 'tsc')
    if (helIdx !== -1 && tscIdx !== -1) {
      const equipIdx = [0, 1, 2].find(i => i !== helIdx && i !== tscIdx)!
      const equipItem = items[equipIdx]!
      if (getFilledSocketCount(equipItem) > 0) {
        const cleaned = unsocketEquipmentItem(equipItem)
        return {
          matched: true,
          recipeName: 'Unsocket Item (Hel + Scroll of Town Portal)',
          resultItems: [{ item: cleaned, col: 0, row: 0 }],
        }
      }
    }
  }

  // 2. Check Normal Base Socketing Recipes (4 items: 2 runes + 1 perfect gem + 1 normal unsocketed equipment)
  if (items.length === 4) {
    const equipCandidates = items.filter(it => {
      const c = extractItemCode(it)
      return !isRuneCode(c) && !isGemCode(c) && c !== 'tsc' && c !== 'isc' && c !== 'jew'
    })
    if (equipCandidates.length === 1) {
      const equipUi = equipCandidates[0]!
      const rawEquip = equipUi.rawItem
      const existingSockets = getTotalSocketCount(equipUi)
      const isStrictNormal =
        equipUi.quality === 'normal' &&
        (!rawEquip ||
          ((rawEquip.quality === undefined || rawEquip.quality === ItemQuality.NORMAL) &&
            rawEquip.rarity !== 'superior' &&
            rawEquip.rarity !== 'low' &&
            !equipUi.name.startsWith('Superior ') &&
            !equipUi.name.startsWith('Cracked ')))

      if (existingSockets === 0 && isStrictNormal) {
        const otherCodes = items
          .filter(it => it !== equipUi)
          .map(it => extractItemCode(it))
          .sort()
        const applyType = resolveGemApplyType(equipUi)
        const tables = getEmbeddedDropTables()
        const eqCode = extractItemCode(equipUi)
        const baseDef = rawEquip?.base ?? tables.getBase(eqCode)
        const typeCode = (baseDef?.type || '').trim().toLowerCase()
        const itemTypeDef = tables.itemTypes.byCode.get(typeCode)
        const maxBaseSockets = Number((baseDef as any)?.gemsockets ?? (baseDef as any)?.gemSockets ?? 0)
        const ilvl = rawEquip?.ilvl ?? rawEquip?.level ?? baseDef?.level ?? 40
        const maxAllowedSockets = itemTypeDef
          ? getMaxSockets(maxBaseSockets, itemTypeDef, ilvl)
          : maxBaseSockets

        if (maxAllowedSockets > 0) {
          const isHelm =
            applyType === 1 &&
            (typeCode === 'helm' ||
              typeCode === 'phlm' ||
              typeCode === 'pelt' ||
              typeCode === 'circ' ||
              tables.isA(typeCode, 'helm'))
          const isTorso =
            applyType === 1 && !isHelm && (typeCode === 'tors' || tables.isA(typeCode, 'tors'))

          let rollCap = 0
          let recipeLabel = ''
          // Weapon: Ral (r08) + Amn (r11) + Perfect Amethyst (gpv) -> ['gpv', 'r08', 'r11']
          if (
            applyType === 0 &&
            otherCodes[0] === 'gpv' &&
            otherCodes[1] === 'r08' &&
            otherCodes[2] === 'r11'
          ) {
            rollCap = 6
            recipeLabel = 'Socket Normal Weapon (Ral + Amn + Perfect Amethyst)'
          }
          // Body Armor: Tal (r07) + Thul (r10) + Perfect Topaz (gpy) -> ['gpy', 'r07', 'r10']
          else if (
            isTorso &&
            otherCodes[0] === 'gpy' &&
            otherCodes[1] === 'r07' &&
            otherCodes[2] === 'r10'
          ) {
            rollCap = 4
            recipeLabel = 'Socket Normal Body Armor (Tal + Thul + Perfect Topaz)'
          }
          // Helm: Ral (r08) + Thul (r10) + Perfect Sapphire (gpb) -> ['gpb', 'r08', 'r10']
          else if (
            isHelm &&
            otherCodes[0] === 'gpb' &&
            otherCodes[1] === 'r08' &&
            otherCodes[2] === 'r10'
          ) {
            rollCap = 3
            recipeLabel = 'Socket Normal Helm (Ral + Thul + Perfect Sapphire)'
          }
          // Shield: Tal (r07) + Amn (r11) + Perfect Ruby (gpr) -> ['gpr', 'r07', 'r11']
          else if (
            applyType === 2 &&
            otherCodes[0] === 'gpr' &&
            otherCodes[1] === 'r07' &&
            otherCodes[2] === 'r11'
          ) {
            rollCap = 4
            recipeLabel = 'Socket Normal Shield (Tal + Amn + Perfect Ruby)'
          }

          if (rollCap > 0 && baseDef) {
            const rolled = rng.int(1, rollCap)
            const finalSockets = Math.max(1, Math.min(rolled, maxAllowedSockets))
            const isEth = Boolean(equipUi.ethereal || rawEquip?.flags?.ethereal)
            const socketedRaw = createSocketedBaseItem(eqCode, finalSockets, {
              ilvl,
              quality: ItemQuality.NORMAL,
              ethereal: isEth,
              baseRolledProps: rawEquip?.rolledProps,
            })
            const socketedUi = toUiItemWithId(socketedRaw, equipUi.id)
            return {
              matched: true,
              recipeName: recipeLabel,
              resultItems: [{ item: socketedUi, col: 0, row: 0 }],
            }
          }
        }
      }
    }
  }

  // 3. Check Rune Upgrade Recipes
  const runeCodes = codes.filter(c => isRuneCode(c))
  if (runeCodes.length >= 2 && runeCodes.every(c => c === runeCodes[0])) {
    const runeNum = Number(runeCodes[0]!.slice(1))
    const recipe = RUNE_UPGRADE_RECIPES[runeNum]
    if (recipe && runeNum < 33 && runeCodes.length === recipe.count) {
      const nonRunes = codes.filter(c => !isRuneCode(c))
      // Match either exact 1.13c gem or pure rune stack (3x/2x runes)
      const gemMatches =
        !recipe.gemCode
          ? nonRunes.length === 0
          : (nonRunes.length === 1 && nonRunes[0] === recipe.gemCode) || nonRunes.length === 0
      if (gemMatches) {
        const nextCode = `r${String(runeNum + 1).padStart(2, '0')}`
        const nextRuneRaw = createSocketableItem(nextCode)
        const nextRuneUi = toUiItemWithId(nextRuneRaw, `cube_rune_${nextCode}_${++cubeItemSeqCounter}`)
        return {
          matched: true,
          recipeName: `Upgrade Rune (${runeCodes[0]} -> ${nextCode})`,
          resultItems: [{ item: nextRuneUi, col: 0, row: 0 }],
        }
      }
    }
  }

  // 4. Check 3x Same Gem Upgrade Recipes
  if (codes.length === 3 && codes[0] === codes[1] && codes[1] === codes[2]) {
    const gemCode = codes[0]!
    for (const chain of GEM_UPGRADE_CHAINS) {
      const idx = chain.indexOf(gemCode)
      if (idx !== -1 && idx + 1 < chain.length) {
        const nextGemCode = chain[idx + 1]!
        const nextGemRaw = createSocketableItem(nextGemCode)
        const nextGemUi = toUiItemWithId(nextGemRaw, `cube_gem_${nextGemCode}_${++cubeItemSeqCounter}`)
        return {
          matched: true,
          recipeName: `Upgrade Gem (${gemCode} -> ${nextGemCode})`,
          resultItems: [{ item: nextGemUi, col: 0, row: 0 }],
        }
      }
    }
  }

  return { matched: false, resultItems: cubePlacements }
}
