/**
 * HUD Item & Unit Adapters (`src/client/ui-model/hud-item-adapter.ts`).
 *
 * Converts `ClientWorld` `ItemData` records (`0x9C` / `0x9D`) into canonical 1.13c `UiInventoryItem`
 * instances with fast O(1) reference/digest caching, computes container digests, converts
 * `ClientUnit` monsters into `MonsterTargetHudInfo`, and resolves class codes & next-level XP.
 *
 * Zero imports from `src/netproto/{bncs,mcp,d2gs,crypto}/**` — consumes only `src/netproto/index.ts`.
 */

import { onlineItemDataToUiInventoryItem } from '../../common/items/item-bridge.ts'
import { D2_EXPERIENCE_TABLE_99 } from '../../common/skills/formulas.ts'
import type { CharacterClassCode } from '../../common/units/classes.ts'
import {
  CANONICAL_CHAMPION_MODIFIERS,
  CANONICAL_ELITE_MODIFIERS,
  FIXED_UNIQUE_BOSS_HCIDX_SET,
  applyMonsterUModResistances,
  getMonsterKindByHcIdx,
  getSuperUniqueByIndex,
  monsterDisplayName,
  rollUniqueMonsterNameKeys,
  type Difficulty,
} from '../../common/units/monsters-data.ts'
import type { CharClassId, ItemData, ItemStat } from '../../netproto/index.ts'
import type { BaseStatKey } from '../ui/character-sheet.ts'
import type { UiInventoryItem } from '../ui/inventory.ts'
import {
  MONSTER_UMOD_TBL_KEYS,
  lookupMonsterTblString,
  type MonsterTargetHudInfo,
} from '../ui/world-panels.ts'
import type { ClientUnit } from '../world/client-unit.ts'
import type { ClientWorld } from '../world/client-world.ts'
import { D2StatId } from '../world/stat-list.ts'
import { CLASS_ID_TO_CODE } from './hud-skill-bonuses.ts'

export interface UiItemCacheEntry {
  sig: string
  ui: UiInventoryItem
  rawRef: ItemData
  statsRef: readonly ItemStat[] | undefined
  statsLen: number
  socketChildrenRef: readonly ItemData[] | undefined
  socketChildrenLen: number
  playerLevel: number
  equippedSig: string
  curDurability: number | undefined
  maxDurability: number | undefined
  quantity: number | undefined
  identified: boolean | undefined
  rawFlags: number | undefined
  gridX: number | undefined
  gridY: number | undefined
  bodyLoc: number | undefined
}

export function formatStatSignature(stats: readonly ItemStat[] | undefined): string {
  if (!stats || stats.length === 0) return ''
  let out = ''
  for (let i = 0; i < stats.length; i++) {
    const s = stats[i]!
    const id = s.statId ?? (s as unknown as { id?: number }).id ?? 0
    out += `${id}:${s.param ?? 0}:${s.value ?? 0},`
  }
  return out
}

export function computeEquippedItemsSignature(equippedItems: readonly ItemData[]): string {
  if (equippedItems.length === 0) return ''
  let sig = ''
  for (let i = 0; i < equippedItems.length; i++) {
    const eq = equippedItems[i]!
    sig += `${eq.id}:${eq.code}:${eq.quality ?? ''}:${(eq as { setItemId?: number }).setItemId ?? ''}:${eq.bodyLoc || eq.equippedSlot || 0}:${eq.identified !== false ? 1 : 0}:${eq.broken ? 1 : 0}|`
  }
  return sig
}

export function computeItemUiCacheKey(
  item: ItemData,
  socketChildren: readonly ItemData[] | undefined,
  playerLevel: number,
  equippedSig: string,
): string {
  const anyItem = item as unknown as Record<string, unknown>
  const flagsObj =
    typeof item.flags === 'object' && item.flags !== null
      ? (item.flags as unknown as Record<string, unknown>)
      : null
  let childSig = ''
  if (socketChildren && socketChildren.length > 0) {
    for (let i = 0; i < socketChildren.length; i++) {
      const c = socketChildren[i]!
      childSig += `${c.id}:${c.code}:${formatStatSignature(c.stats)};`
    }
  }
  const setBonusLen = Array.isArray(item.setBonusStats) ? item.setBonusStats.length : 0
  return [
    playerLevel,
    equippedSig,
    item.id ?? '',
    item.code ?? '',
    item.quality ?? '',
    item.identified ?? '',
    flagsObj
      ? `${flagsObj.identified ?? ''}:${flagsObj.ethereal ?? ''}:${flagsObj.socketed ?? ''}:${flagsObj.runeword ?? ''}:${flagsObj.gamble ?? ''}`
      : String(item.flags ?? ''),
    item.ethereal ?? '',
    item.broken ?? '',
    item.socketed ?? '',
    anyItem.sockets ?? item.totalSockets ?? '',
    item.usedSockets ?? '',
    item.quantity ?? '',
    item.goldAmount ?? '',
    item.curDurability ?? item.durability ?? '',
    item.maxDurability ?? '',
    item.defense ?? '',
    item.gridX ?? item.x ?? '',
    item.gridY ?? item.y ?? '',
    item.bodyLoc ?? item.equippedSlot ?? '',
    item.container ?? item.location ?? '',
    anyItem.storePage ?? '',
    anyItem.personalizedName ?? '',
    anyItem.buyCost ?? '',
    anyItem.sellCost ?? '',
    anyItem.setItemId ?? '',
    anyItem.uniqueItemId ?? '',
    anyItem.runewordId ?? '',
    anyItem.magicPrefixId ?? '',
    anyItem.magicSuffixId ?? '',
    anyItem.graphicIndex ?? anyItem.variant ?? '',
    setBonusLen,
    formatStatSignature(item.stats),
    formatStatSignature(item.runewordStats),
    childSig,
  ].join('|')
}

export const STAT_KEY_TO_D2_STAT_ID: Readonly<Record<BaseStatKey, number>> = {
  str: D2StatId.Strength,
  ene: D2StatId.Energy,
  dex: D2StatId.Dexterity,
  vit: D2StatId.Vitality,
} as const

/**
 * Converts a decoded `ItemData` record (`0x9C` / `0x9D`) from `ClientWorld` into a canonical 1.13c `UiInventoryItem`
 * suitable for rendering and interaction inside `HudManager` (`InventoryPanel`, `WorldPanelsHud`, `BeltHud`).
 */
export function itemDataToUiInventoryItem(
  item: ItemData,
  socketChildren?: readonly ItemData[],
  playerLevel?: number,
  equippedItems?: readonly ItemData[],
): UiInventoryItem {
  const stat70 = item.stats?.find((s) => (s.statId ?? (s as { id?: number }).id) === 70)?.value
  const normalizedItem =
    item.quantity === 0 && typeof stat70 === 'number' && stat70 > 0
      ? { ...item, quantity: stat70 }
      : item
  const ui = onlineItemDataToUiInventoryItem(
    normalizedItem,
    socketChildren,
    undefined,
    playerLevel,
    equippedItems,
  )
  const variant =
    (item as { graphicIndex?: number; variant?: number }).graphicIndex ??
    (item as { variant?: number }).variant ??
    (ui as { variant?: number }).variant
  if (variant !== undefined) {
    ;(ui as { variant?: number }).variant = variant
  }
  return ui
}

export function computeEquippedDigestForWorld(world: ClientWorld): number {
  let h = 2166136261 >>> 0
  const mix = (n: number): void => {
    h = Math.imul(h ^ (n | 0), 16777619) >>> 0
  }
  mix(world.containers.equipment.size)
  for (const eq of world.containers.equipment.values()) {
    mix(Number(eq.id) || 0)
    mix(eq.bodyLoc || eq.equippedSlot || 0)
    mix(eq.identified === false ? 0 : 1)
    mix(eq.broken ? 1 : 0)
    mix(eq.curDurability ?? eq.durability ?? -1)
    mix(eq.maxDurability ?? -1)
    mix(eq.rawFlags ?? 0)
    mix(eq.stats?.length ?? 0)
  }
  return h
}

export function resolveEquippedContextForModel(model: any): {
  readonly equippedItems: readonly ItemData[]
  readonly equippedSig: string
} {
  if (model.activeSyncEquippedItems !== null && model.activeSyncEquippedSig !== null) {
    return {
      equippedItems: model.activeSyncEquippedItems,
      equippedSig: model.activeSyncEquippedSig,
    }
  }
  const rev =
    (model.world.containers as { hudRevision?: number; revision?: number }).hudRevision ??
    (model.world.containers as { revision?: number }).revision ??
    -1
  const digest = model.computeEquippedDigest()
  if (
    rev >= 0 &&
    rev === model.cachedEquippedRev &&
    digest === model.cachedEquippedDigest
  ) {
    return {
      equippedItems: model.cachedEquippedItems,
      equippedSig: model.cachedEquippedSig,
    }
  }
  const items = [...model.world.containers.equipment.values()]
  const sig = computeEquippedItemsSignature(items)
  model.cachedEquippedRev = rev
  model.cachedEquippedDigest = digest
  model.cachedEquippedItems = items
  model.cachedEquippedSig = sig
  return { equippedItems: items, equippedSig: sig }
}

export function computeHudContainersDigestForWorld(world: ClientWorld): number {
  let h = 2166136261 >>> 0
  const mix = (n: number): void => {
    h = Math.imul(h ^ (n | 0), 16777619) >>> 0
  }
  const mixItem = (item: ItemData | null | undefined): void => {
    if (!item) {
      mix(0)
      return
    }
    mix(Number(item.id) || 0)
    mix(item.gridX ?? item.x ?? -1)
    mix(item.gridY ?? item.y ?? -1)
    mix(item.bodyLoc || item.equippedSlot || 0)
    mix(item.curDurability ?? item.durability ?? -1)
    mix(item.maxDurability ?? -1)
    mix(item.quantity ?? -1)
    mix(item.identified === false ? 0 : 1)
    mix(item.rawFlags ?? 0)
    mix(typeof item.quality === 'number' ? item.quality : String(item.quality ?? '').length)
    mix(Number((item as any).rareName1 ?? (item as any).rarePrefixId ?? 0))
    mix(Number((item as any).rareName2 ?? (item as any).rareSuffixId ?? 0))
    mix(Number(item.totalSockets ?? (item as any).sockets ?? 0))
    mix(item.personalized ? 1 : 0)
    mix(item.stats?.length ?? 0)
    const firstStat = item.stats?.[0]
    if (firstStat) {
      mix(firstStat.statId ?? 0)
      mix(firstStat.value ?? 0)
    }
  }
  const c = world.containers
  mix(c.equipment.size)
  for (const it of c.equipment.values()) mixItem(it)
  mix(c.inventory.size)
  for (const it of c.inventory.values()) mixItem(it)
  mix(c.stash.size)
  for (const it of c.stash.values()) mixItem(it)
  mix(c.cube.size)
  for (const it of c.cube.values()) mixItem(it)
  mix(c.belt.size)
  for (const it of c.belt.values()) mixItem(it)
  mix(c.merc.size)
  for (const it of c.merc.values()) mixItem(it)
  if (c.mercBySlot) {
    mix(c.mercBySlot.size)
    for (const it of c.mercBySlot.values()) mixItem(it)
  }
  mixItem(c.cursor)
  mix(c.sockets.size)
  for (const [parentId, list] of c.sockets.entries()) {
    mix(parentId)
    mix(list.length)
  }
  mix(c.shop.size)
  for (const it of c.shop.values()) mixItem(it)
  mix(c.tradeSelf.size)
  for (const it of c.tradeSelf.values()) mixItem(it)
  mix(c.tradePartner.size)
  for (const it of c.tradePartner.values()) mixItem(it)
  return h
}

export interface ConvertWorldItemOptions {
  readonly unitLevel?: number | undefined
  readonly equippedItems?: readonly ItemData[] | undefined
  readonly equippedSig?: string | undefined
}

export function convertWorldItemToUiItem(
  model: any,
  item: ItemData,
  options?: ConvertWorldItemOptions,
): UiInventoryItem {
  const playerLevel =
    options?.unitLevel !== undefined && options.unitLevel > 0
      ? Math.max(1, Math.trunc(options.unitLevel))
      : Math.max(
          1,
          model.world.self.level || model.world.self.stats.get(D2StatId.Level) || 1,
        )
  const resolvedContext =
    options?.equippedItems !== undefined
      ? {
          equippedItems: options.equippedItems,
          equippedSig:
            options.equippedSig ?? ('merc:' + computeEquippedItemsSignature(options.equippedItems)),
        }
      : model.resolveEquippedContext()
  const { equippedItems, equippedSig } = resolvedContext
  const socketChildren = model.world.containers.sockets.get(item.id)

  const itemId = item.id as number | string | undefined
  const hasStableId =
    typeof itemId === 'number'
      ? itemId !== 0 && Number.isFinite(itemId)
      : typeof itemId === 'string' && itemId.length > 0
  const cached: UiItemCacheEntry | undefined =
    hasStableId && itemId !== undefined
      ? model.uiItemCacheById.get(itemId)
      : model.uiItemCacheByRef.get(item)

  const curDurability = item.curDurability ?? item.durability
  const maxDurability = item.maxDurability
  const quantity = item.quantity
  const identified = item.identified
  const rawFlags = item.rawFlags
  const gridX = item.gridX ?? item.x
  const gridY = item.gridY ?? item.y
  const bodyLoc = item.bodyLoc ?? item.equippedSlot
  const statsRef = item.stats
  const statsLen = statsRef?.length ?? 0
  const socketChildrenLen = socketChildren?.length ?? 0

  // Fast O(1) reference + scalar field check (#940): avoids building the 35-field
  // cache signature string when the underlying ItemData reference and scalar fields are unchanged.
  if (
    cached &&
    cached.rawRef === item &&
    cached.statsRef === statsRef &&
    cached.statsLen === statsLen &&
    cached.socketChildrenRef === socketChildren &&
    cached.socketChildrenLen === socketChildrenLen &&
    cached.playerLevel === playerLevel &&
    cached.equippedSig === equippedSig &&
    cached.curDurability === curDurability &&
    cached.maxDurability === maxDurability &&
    cached.quantity === quantity &&
    cached.identified === identified &&
    cached.rawFlags === rawFlags &&
    cached.gridX === gridX &&
    cached.gridY === gridY &&
    cached.bodyLoc === bodyLoc
  ) {
    return cached.ui
  }

  const cacheSig = computeItemUiCacheKey(item, socketChildren, playerLevel, equippedSig)
  if (cached && cached.sig === cacheSig) {
    cached.rawRef = item
    cached.statsRef = statsRef
    cached.statsLen = statsLen
    cached.socketChildrenRef = socketChildren
    cached.socketChildrenLen = socketChildrenLen
    cached.playerLevel = playerLevel
    cached.equippedSig = equippedSig
    cached.curDurability = curDurability
    cached.maxDurability = maxDurability
    cached.quantity = quantity
    cached.identified = identified
    cached.rawFlags = rawFlags
    cached.gridX = gridX
    cached.gridY = gridY
    cached.bodyLoc = bodyLoc
    return cached.ui
  }

  const ui = itemDataToUiInventoryItem(
    item,
    socketChildren,
    playerLevel,
    equippedItems,
  )
  ;(ui as any).gridX = (ui as any).gridX ?? item.gridX ?? item.x ?? (ui as any).col ?? 0
  ;(ui as any).gridY = (ui as any).gridY ?? item.gridY ?? item.y ?? (ui as any).row ?? 0
  const entry: UiItemCacheEntry = {
    sig: cacheSig,
    ui,
    rawRef: item,
    statsRef,
    statsLen,
    socketChildrenRef: socketChildren,
    socketChildrenLen,
    playerLevel,
    equippedSig,
    curDurability,
    maxDurability,
    quantity,
    identified,
    rawFlags,
    gridX,
    gridY,
    bodyLoc,
  }
  if (hasStableId && itemId !== undefined) {
    if (model.uiItemCacheById.size > 512) {
      model.uiItemCacheById.clear()
    }
    model.uiItemCacheById.set(itemId, entry)
  } else if (item && typeof item === 'object') {
    model.uiItemCacheByRef.set(item, entry)
  }
  return ui
}

export function hasUnidentifiedItemsInWorld(world: ClientWorld): boolean {
  const isUnid = (item: ItemData | undefined): boolean => {
    if (!item) return false
    if (item.identified === false) return true
    if (item.flags && typeof (item.flags as any).identified === 'boolean') {
      return (item.flags as any).identified === false
    }
    return false
  }
  for (const item of world.containers.inventory.values()) {
    if (isUnid(item)) return true
  }
  for (const item of world.containers.cube.values()) {
    if (isUnid(item)) return true
  }
  return false
}

export function getUnidentifiedItemCountInWorld(world: ClientWorld): number {
  let count = 0
  const checkItem = (item: ItemData | undefined): boolean => {
    if (!item) return false
    if (item.identified === false) return true
    if (item.flags && typeof (item.flags as any).identified === 'boolean') {
      return (item.flags as any).identified === false
    }
    return false
  }
  for (const item of world.containers.inventory.values()) {
    if (checkItem(item)) count++
  }
  for (const item of world.containers.cube.values()) {
    if (checkItem(item)) count++
  }
  return count
}

export function clientUnitToMonsterTargetInfo(
  unit: ClientUnit,
  difficulty: 0 | 1 | 2 | Difficulty = 0,
): MonsterTargetHudInfo {
  const hpPct = Math.max(0, Math.min(128, unit.lifePct))
  const kind = getMonsterKindByHcIdx(unit.classId, difficulty)

  // D2Game.dll 0x6fc6ffb9 sets MONFLAG_UNIQUE (0x08) whenever ANY MonUMod is applied
  // (including Champion UMods 16/36/37/38/39), so Champion units arrive over 0xAC AssignNPC
  // with both 0x04 (MONFLAG_CHAMPION) and 0x08 (MONFLAG_UNIQUE) set, plus a 16-bit nameSeed.
  // D2Client.dll sub_6FAD0620 (0x6fad06a2 -> 0x6fad0758 -> 0x6fad0716) and
  // sub_6FB70850 (0x6fb70a8b -> 0x6fb70aa1) strictly prioritize:
  //   SuperUnique (0x02) > Champion (0x04) > Unique (0x08) > Minion (0x10).
  const isSuperUnique = Boolean(unit.isSuperUnique || (unit.flags & 0x02) !== 0)
  const isChampion = Boolean(
    !isSuperUnique && (unit.isChampion || (unit.flags & 0x04) !== 0),
  )
  const isUnique = Boolean(
    !isSuperUnique && !isChampion && (unit.isUnique || (unit.flags & 0x08) !== 0),
  )
  const isMinion = Boolean(
    !isSuperUnique && !isChampion && !isUnique && (unit.flags & 0x10) !== 0,
  )
  const isBoss = Boolean(kind?.boss)

  const rank: MonsterTargetHudInfo['rank'] = isSuperUnique
    ? 'superunique'
    : isChampion
      ? 'champion'
      : isUnique
        ? 'unique'
        : isMinion
          ? 'minion'
          : isBoss
            ? 'boss'
            : 'normal'

  const su =
    isSuperUnique && unit.superUniqueId !== undefined
      ? getSuperUniqueByIndex(unit.superUniqueId)
      : undefined

  // D2Client.dll 0x6facfedb & 0x6fb6fca0: Uber bosses (hcIdx 704..709) suppress MonUMod labels and immunities
  const isUberBoss = unit.classId >= 704 && unit.classId <= 709

  const rawModIds: number[] = isUberBoss
    ? []
    : unit.bossMods && unit.bossMods.length > 0
      ? [...unit.bossMods]
      : su?.modifiers && su.modifiers.length > 0
        ? [...su.modifiers]
        : []
  if (!isUberBoss && isChampion && (unit.flags & 0x40) !== 0 && !rawModIds.includes(36)) {
    rawModIds.unshift(36)
  }

  const explicitName = unit.name && unit.name.trim().length > 0 ? unit.name.trim() : undefined
  const nameKey = su?.nameKey ?? explicitName ?? kind?.nameKey

  let resolvedName =
    explicitName ??
    (nameKey
      ? (lookupMonsterTblString(nameKey, 'en') ??
        monsterDisplayName(nameKey, 'ENG') ??
        nameKey)
      : `Monster #${unit.classId}`)

  if (!explicitName && isChampion) {
    // D2Client.dll 0x6fad0758..0x6fad07c7: Champion subtype lookup (.rdata:0x6fb86d64) + ChampFormatX (0x2b40)
    const champSubtype = CANONICAL_CHAMPION_MODIFIERS.find((c) => rawModIds.includes(c.id))
    const champTblKey = champSubtype?.tblKey ?? 'Champion'
    const prefix = lookupMonsterTblString(champTblKey, 'en') ?? champSubtype?.label ?? 'Champion'
    if (!resolvedName.startsWith(`${prefix} `)) {
      resolvedName = `${prefix} ${resolvedName}`
    }
  } else if (
    !explicitName &&
    isUnique &&
    unit.nameSeed !== undefined &&
    !FIXED_UNIQUE_BOSS_HCIDX_SET.has(unit.classId)
  ) {
    if (unit.bossMods?.includes(12)) {
      resolvedName = lookupMonsterTblString('Blood Raven', 'en') ?? 'Blood Raven'
    } else {
      const partKeys = rollUniqueMonsterNameKeys(unit.nameSeed)
      resolvedName = partKeys.map((k) => lookupMonsterTblString(k, 'en') ?? k).join(' ')
    }
  }

  // D2Client.dll 0x6fb6fca0 & wMonUModStrTable (.data:0x6fba9f88): only the 14 displayed elite
  // MonUMod IDs (5..9, 17, 18, 24..30), the 5 Champion subtypes (16, 36..39), and MonUMod 12
  // (Blood Raven title override at 0x6fad08f8) affect the HUD lifebar title/subtext; internal
  // server/death-FX MonUMod IDs (e.g. 22 questcomplete, 15 killminionsdeath, 4 leveladd) have
  // wMonUModStrTable[id] == 0 and must never leak as raw numbers into the HUD.
  const modifiers = rawModIds.flatMap((m) => {
    const name =
      CANONICAL_CHAMPION_MODIFIERS.find((e) => e.id === m)?.name ??
      CANONICAL_ELITE_MODIFIERS.find((e) => e.id === m)?.name
    if (name) return [name]
    if (m === 12) return ['12']
    return []
  })
  const affixes = rawModIds.flatMap((m) => {
    const key = String(m)
    const entry =
      MONSTER_UMOD_TBL_KEYS[key] ??
      CANONICAL_CHAMPION_MODIFIERS.find((e) => e.id === m) ??
      CANONICAL_ELITE_MODIFIERS.find((e) => e.id === m)
    if (entry) {
      return [lookupMonsterTblString(entry.tblKey, 'en') ?? entry.label]
    }
    return []
  })

  const descKey =
    !isUberBoss && kind?.descKey && kind.descKey.length > 0
      ? kind.descKey
      : undefined

  const resistances =
    !isUberBoss && kind?.resistances
      ? applyMonsterUModResistances(kind.resistances, rawModIds)
      : undefined

  return {
    unitId: unit.id,
    name: resolvedName,
    hcIdx: unit.classId,
    ...(unit.nameSeed !== undefined ? { nameSeed: unit.nameSeed } : {}),
    ...(nameKey !== undefined ? { nameKey } : {}),
    ...(descKey !== undefined ? { descKey } : {}),
    hp: hpPct,
    maxHp: 128,
    rank,
    ...(kind?.isUndead ? { isUndead: true } : {}),
    ...(kind?.isDemon ? { isDemon: true } : {}),
    ...(isBoss ? { isBoss: true } : {}),
    modifiers,
    affixes,
    ...(resistances !== undefined ? { resistances } : {}),
  }
}

/** Resolve a server class id to its class code; throws on an id outside 1.13c's 0..6. */
export function resolveClassCode(classId: CharClassId | number): CharacterClassCode {
  const code = (CLASS_ID_TO_CODE as Record<number, CharacterClassCode | undefined>)[classId]
  if (!code) throw new Error(`HudModel: unknown character class id ${classId}`)
  return code
}

/** XP needed for the next level from `D2_EXPERIENCE_TABLE_99` (index L = XP to reach level L); 0 at level 99 / unknown. */
export function nextLevelExperience(level: number): number {
  if (level < 1 || level >= 99) return 0
  return D2_EXPERIENCE_TABLE_99[level + 1] ?? 0
}
