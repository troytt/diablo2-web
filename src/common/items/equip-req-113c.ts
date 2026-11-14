/**
 * Authoritative Diablo II: Lord of Destruction v1.13c Equipment Requirement & Slot Validator.
 *
 * Ground Truth References:
 * - `D2Common.dll` `#10244` (`0x6FD76DB0` `ITEMS_CheckRequirements`):
 *   - `reqStr = baseReqStr + trunc(baseReqStr * item_req_percent / 100) + (ethereal ? -10 : 0)`
 *   - `reqDex = baseReqDex + trunc(baseReqDex * item_req_percent / 100) + (ethereal ? -10 : 0)`
 *   - Unidentified (`ITEMFLAG_IDENTIFIED` `0x10` clear) and broken (`ITEMFLAG_BROKEN` `0x100`) items fail.
 * - `D2Common.dll` `#11015` (`0x6FD76190` `ITEMS_GetRequiredLevel`):
 *   - Max of base `levelreq`, quality-specific affix/unique/set/crafted (`10 + 3*N + maxAffixReq`),
 *     skill modifiers (`stat 107` / `stat 97`), and all socketed gems/runes/jewels, plus `stat 92`
 *     (`item_levelreq`, e.g. `+5` / `+7` / `+12` Horadric Cube base upgrades).
 * - `D2Common.dll` `#10751` (`0x6FD77160` `ITEMS_CanEquip`) & `ItemTypes.txt`:
 *   - `Body = 1` and `BodyLoc1`/`BodyLoc2` slot matching (`1..12` on players, `1,3,4,5` on mercenaries).
 *   - `Class` column class-specific equipment restrictions (`ama`, `sor`, `nec`, `pal`, `bar`, `dru`, `ass`).
 *   - Two-handed weapon / bow+quiver (`Shoots`/`Quiver`) / Barbarian `1or2handed` sword & dual-wield /
 *     Assassin `h2h`/`h2h2` dual-claw opposite-hand exclusion rules.
 */

import { RAW_ARMOR, RAW_ITEM_TYPES, RAW_MISC, RAW_WEAPONS } from '../data/canonical-drop-data.ts'
import type { CharacterClassCode } from '../units/classes.ts'
import type { DropTables } from './drop-tables.ts'
import { getEmbeddedDropTables } from './embedded-drop-tables.ts'
import { CANONICAL_GEMS_TABLE } from './gems.ts'
import { GEM_INFO, RUNE_INFO } from './gems-data.ts'
import { resolveOnlineItemReqLevel } from './item-bridge.ts'
import { itemTypeIsA } from './item-types.ts'

export interface ItemTypeEquipMeta113c {
  readonly code: string
  readonly equiv1: string
  readonly equiv2: string
  readonly body: boolean
  readonly bodyLoc1: string
  readonly bodyLoc2: string
  readonly shoots: string
  readonly quiver: string
  readonly classOnly?: CharacterClassCode | undefined
}

export interface ItemBaseEquipMeta113c {
  readonly code: string
  readonly kind: 'armor' | 'weapon' | 'misc'
  readonly type: string
  readonly type2: string
  readonly reqStr: number
  readonly reqDex: number
  readonly levelReq: number
  readonly oneOrTwoHanded: boolean
  readonly twoHanded: boolean
  readonly gemApplyType: number
  readonly normCode: string
  readonly uberCode: string
  readonly ultraCode: string
}

export interface EquipStatEntry113c {
  readonly statId: number
  readonly param?: number | undefined
  readonly value: number
}

export interface EquipCandidateItem113c {
  readonly unitId?: number | undefined
  readonly id?: number | undefined
  readonly code: string
  readonly bodyLoc?: number | undefined
  readonly quality?: number | string | undefined
  readonly level?: number | undefined
  readonly ilvl?: number | undefined
  readonly identified?: boolean | undefined
  readonly ethereal?: boolean | undefined
  readonly broken?: boolean | undefined
  readonly durability?: number | undefined
  readonly maxDurability?: number | undefined
  readonly reqLevel?: number | undefined
  readonly stats?: ReadonlyMap<number, number> | readonly EquipStatEntry113c[] | undefined
  readonly runewordStats?: readonly EquipStatEntry113c[] | undefined
  readonly socketedItems?: readonly EquipCandidateItem113c[] | undefined
  readonly rawItemData?: object | undefined
}

export interface EquipUnitContext113c {
  readonly kind: 'player' | 'mercenary'
  readonly level: number
  readonly baseStrength: number
  readonly baseDexterity: number
  readonly bonusStrength?: number | undefined
  readonly bonusDexterity?: number | undefined
  readonly classCode?: CharacterClassCode | undefined
  readonly mercAct?: 1 | 2 | 3 | 5 | undefined
}

export interface ComputedItemRequirements113c {
  readonly reqLevel: number
  readonly reqStr: number
  readonly reqDex: number
  readonly baseReqStr: number
  readonly baseReqDex: number
  readonly easePercent: number
  readonly isEthereal: boolean
  readonly classOnly?: CharacterClassCode | undefined
  readonly validSlots: readonly number[]
}

export type EquipRejectReason113c =
  | 'unknown_item'
  | 'not_equippable'
  | 'invalid_slot'
  | 'invalid_merc_slot'
  | 'invalid_merc_type'
  | 'unidentified'
  | 'broken'
  | 'wrong_class'
  | 'level_too_low'
  | 'strength_too_low'
  | 'dexterity_too_low'
  | 'opposite_hand_conflict'

export interface CanUnitEquipOptions113c<T extends EquipCandidateItem113c = EquipCandidateItem113c> {
  readonly dropTables?: DropTables | undefined
  /**
   * When true, any opposite-hand conflict is rejected directly (`reason: 'opposite_hand_conflict'`)
   * rather than marking the opposite-hand item for displacement. Defaults to `false`.
   */
  readonly strictSlotConflict?: boolean | undefined
  /**
   * Optional server-authoritative callback computing the unit's effective `{ strength, dexterity }`
   * after excluding `displacedItems` (preserving charms, set bonuses, buffs, per-level stats, etc.).
   */
  readonly computeAttributesWithoutDisplaced?:
    | ((displacedItems: readonly T[]) => { readonly strength: number; readonly dexterity: number })
    | undefined
}

export interface CanUnitEquipResult113c<T extends EquipCandidateItem113c = EquipCandidateItem113c> {
  readonly allowed: boolean
  readonly reason?: EquipRejectReason113c | undefined
  readonly requirements: ComputedItemRequirements113c
  readonly effectiveUnitStats: {
    readonly level: number
    readonly strength: number
    readonly dexterity: number
  }
  readonly displacedTargetItem?: T | undefined
  readonly displacedOppositeItem?: T | undefined
  readonly displacedItems: readonly T[]
}

const VALID_CLASS_CODES = new Set<string>(['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass'])

let cachedItemTypesMap: ReadonlyMap<string, ItemTypeEquipMeta113c> | null = null
let cachedItemBasesMap: ReadonlyMap<string, ItemBaseEquipMeta113c> | null = null

function parseItemTypesEquipMap113c(): ReadonlyMap<string, ItemTypeEquipMeta113c> {
  if (cachedItemTypesMap !== null) return cachedItemTypesMap
  const lines = RAW_ITEM_TYPES.split(/\r?\n/)
  if (lines.length === 0) {
    cachedItemTypesMap = new Map()
    return cachedItemTypesMap
  }
  const hdr = lines[0]!.split('\t').map((h) => h.trim())
  const col = (name: string) => hdr.indexOf(name)
  const iCode = col('Code')
  const iEq1 = col('Equiv1')
  const iEq2 = col('Equiv2')
  const iBody = col('Body')
  const iLoc1 = col('BodyLoc1')
  const iLoc2 = col('BodyLoc2')
  const iShoots = col('Shoots')
  const iQuiver = col('Quiver')
  const iClass = col('Class')

  const rawMap = new Map<string, ItemTypeEquipMeta113c>()
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const cols = line.split('\t')
    const code = (cols[iCode] ?? '').trim().toLowerCase()
    if (!code) continue
    const clsRaw = (cols[iClass] ?? '').trim().toLowerCase()
    rawMap.set(code, {
      code,
      equiv1: (cols[iEq1] ?? '').trim().toLowerCase(),
      equiv2: (cols[iEq2] ?? '').trim().toLowerCase(),
      body: (cols[iBody] ?? '').trim() === '1',
      bodyLoc1: (cols[iLoc1] ?? '').trim().toLowerCase(),
      bodyLoc2: (cols[iLoc2] ?? '').trim().toLowerCase(),
      shoots: (cols[iShoots] ?? '').trim().toLowerCase(),
      quiver: (cols[iQuiver] ?? '').trim().toLowerCase(),
      ...(VALID_CLASS_CODES.has(clsRaw) ? { classOnly: clsRaw as CharacterClassCode } : {}),
    })
  }

  // Inherit `classOnly`, `shoots`, and `quiver` across the `Equiv1`/`Equiv2` DAG per D2Common.
  const resolved = new Map<string, ItemTypeEquipMeta113c>()
  const resolveInherited = (code: string, visited: Set<string>): ItemTypeEquipMeta113c | undefined => {
    const existing = resolved.get(code)
    if (existing) return existing
    const raw = rawMap.get(code)
    if (!raw) return undefined
    if (visited.has(code)) return raw
    visited.add(code)
    const p1 = raw.equiv1 ? resolveInherited(raw.equiv1, visited) : undefined
    const p2 = raw.equiv2 ? resolveInherited(raw.equiv2, visited) : undefined
    const classOnly = raw.classOnly ?? p1?.classOnly ?? p2?.classOnly
    const shoots = raw.shoots || p1?.shoots || p2?.shoots || ''
    const quiver = raw.quiver || p1?.quiver || p2?.quiver || ''
    const merged: ItemTypeEquipMeta113c = {
      ...raw,
      shoots,
      quiver,
      ...(classOnly !== undefined ? { classOnly } : {}),
    }
    resolved.set(code, merged)
    return merged
  }
  for (const code of rawMap.keys()) {
    resolveInherited(code, new Set())
  }
  cachedItemTypesMap = resolved
  return resolved
}

function parseItemBasesEquipMap113c(): ReadonlyMap<string, ItemBaseEquipMeta113c> {
  if (cachedItemBasesMap !== null) return cachedItemBasesMap
  const map = new Map<string, ItemBaseEquipMeta113c>()

  const ingest = (tsv: string, kind: 'armor' | 'weapon' | 'misc'): void => {
    const lines = tsv.split(/\r?\n/)
    if (lines.length === 0) return
    const hdr = lines[0]!.split('\t').map((h) => h.trim().toLowerCase())
    const col = (name: string) => hdr.indexOf(name.toLowerCase())
    const iCode = col('code')
    const iType = col('type')
    const iType2 = col('type2')
    const iReqStr = col('reqstr')
    const iReqDex = col('reqdex')
    const iLevelReq = col('levelreq')
    const i1or2 = col('1or2handed')
    const i2h = col('2handed')
    const iGemApply = col('gemapplytype')
    const iNorm = col('normcode')
    const iUber = col('ubercode')
    const iUltra = col('ultracode')
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (!line) continue
      const cols = line.split('\t')
      const code = iCode >= 0 ? (cols[iCode] ?? '').trim() : ''
      if (!code || code.toLowerCase() === 'expansion') continue
      const num = (idx: number) => (idx >= 0 ? Number((cols[idx] ?? '').trim()) || 0 : 0)
      const str = (idx: number) => (idx >= 0 ? (cols[idx] ?? '').trim() : '')
      map.set(code, {
        code,
        kind,
        type: str(iType).toLowerCase(),
        type2: str(iType2).toLowerCase(),
        reqStr: Math.max(0, Math.trunc(num(iReqStr))),
        reqDex: Math.max(0, Math.trunc(num(iReqDex))),
        levelReq: Math.max(0, Math.trunc(num(iLevelReq))),
        oneOrTwoHanded: str(i1or2) === '1',
        twoHanded: str(i2h) === '1',
        gemApplyType: Math.max(0, Math.trunc(num(iGemApply))),
        normCode: str(iNorm),
        uberCode: str(iUber),
        ultraCode: str(iUltra),
      })
    }
  }

  ingest(RAW_ARMOR, 'armor')
  ingest(RAW_WEAPONS, 'weapon')
  ingest(RAW_MISC, 'misc')
  cachedItemBasesMap = map
  return map
}

export function getItemTypeEquipMeta113c(typeCode: string): ItemTypeEquipMeta113c | undefined {
  return parseItemTypesEquipMap113c().get(typeCode.trim().toLowerCase())
}

export function getItemBaseEquipMeta113c(itemCode: string): ItemBaseEquipMeta113c | undefined {
  const trimmed = itemCode.trim()
  const bases = parseItemBasesEquipMap113c()
  return bases.get(trimmed) ?? bases.get(trimmed.toLowerCase())
}

function bodyLocCodeToSlots113c(locCode: string, includeWeaponSwap: boolean): readonly number[] {
  switch (locCode) {
    case 'head':
      return [1]
    case 'neck':
      return [2]
    case 'tors':
      return [3]
    case 'rarm':
      return includeWeaponSwap ? [4, 11] : [4]
    case 'larm':
      return includeWeaponSwap ? [5, 12] : [5]
    case 'rrin':
      return [6]
    case 'lrin':
      return [7]
    case 'belt':
      return [8]
    case 'feet':
      return [9]
    case 'glov':
      return [10]
    default:
      return []
  }
}

export function resolveValidBodySlotsForType113c(
  typeMeta: ItemTypeEquipMeta113c | undefined,
  includeWeaponSwap = true,
): readonly number[] {
  if (!typeMeta || !typeMeta.body) return []
  const out: number[] = []
  for (const s of bodyLocCodeToSlots113c(typeMeta.bodyLoc1, includeWeaponSwap)) {
    if (!out.includes(s)) out.push(s)
  }
  for (const s of bodyLocCodeToSlots113c(typeMeta.bodyLoc2, includeWeaponSwap)) {
    if (!out.includes(s)) out.push(s)
  }
  return out
}

function extractOwnStatSum113c(item: EquipCandidateItem113c, targetStatId: number): {
  sum: number
  hasAnyExplicitStats: boolean
} {
  let sum = 0
  let hasAnyExplicitStats = false
  const raw = item.rawItemData as
    | {
        readonly stats?: readonly EquipStatEntry113c[] | undefined
        readonly runewordStats?: readonly EquipStatEntry113c[] | undefined
      }
    | undefined

  if (item.stats instanceof Map && item.stats.size > 0) {
    for (const [sid, val] of item.stats.entries()) {
      hasAnyExplicitStats = true
      if (sid === targetStatId) sum += Number(val) || 0
    }
    return { sum, hasAnyExplicitStats }
  }
  if (Array.isArray(item.stats) && item.stats.length > 0) {
    for (const s of item.stats) {
      hasAnyExplicitStats = true
      if (Number(s.statId) === targetStatId) sum += Number(s.value) || 0
    }
    if (Array.isArray(item.runewordStats)) {
      for (const s of item.runewordStats) {
        hasAnyExplicitStats = true
        if (Number(s.statId) === targetStatId) sum += Number(s.value) || 0
      }
    }
    return { sum, hasAnyExplicitStats }
  }

  if (
    raw &&
    ((Array.isArray(raw.stats) && raw.stats.length > 0) ||
      (Array.isArray(raw.runewordStats) && raw.runewordStats.length > 0))
  ) {
    for (const s of raw.stats ?? []) {
      hasAnyExplicitStats = true
      if (Number(s.statId) === targetStatId) sum += Number(s.value) || 0
    }
    for (const s of raw.runewordStats ?? []) {
      hasAnyExplicitStats = true
      if (Number(s.statId) === targetStatId) sum += Number(s.value) || 0
    }
    return { sum, hasAnyExplicitStats }
  }

  if (Array.isArray(item.runewordStats) && item.runewordStats.length > 0) {
    for (const s of item.runewordStats) {
      hasAnyExplicitStats = true
      if (Number(s.statId) === targetStatId) sum += Number(s.value) || 0
    }
  }
  return { sum, hasAnyExplicitStats }
}

function resolveHostSocketCategory113c(
  hostBase: ItemBaseEquipMeta113c | undefined,
): 'weapon' | 'helm' | 'shield' | undefined {
  if (!hostBase) return undefined
  if (hostBase.kind === 'weapon' || itemTypeIsA(hostBase.type, 'weap')) return 'weapon'
  if (itemTypeIsA(hostBase.type, 'shld')) return 'shield'
  if (itemTypeIsA(hostBase.type, 'armo')) return 'helm'
  return undefined
}

function resolveSocketChildGemStat113c(
  childCode: string,
  hostCategory: 'weapon' | 'helm' | 'shield' | undefined,
  targetStatId: number,
  tables: DropTables,
): number {
  if (!hostCategory || !tables.properties || !tables.itemStatCost) return 0
  const gem = CANONICAL_GEMS_TABLE.get(childCode.trim().toLowerCase())
  if (!gem) return 0
  const mods =
    hostCategory === 'weapon'
      ? gem.weaponMods
      : hostCategory === 'shield'
        ? gem.shieldMods
        : gem.helmMods
  let total = 0
  for (const mod of mods) {
    const param = typeof mod.param === 'number' ? mod.param : Number(mod.param ?? 0) || 0
    for (const r of tables.properties.resolveProperty(
      mod.code,
      param,
      mod.min,
      mod.max,
      tables.itemStatCost,
    )) {
      if (r.statId === targetStatId) {
        total += Math.trunc((r.min + r.max) / 2)
      }
    }
  }
  return total
}

function sumItemAndSocketsStat113c(
  item: EquipCandidateItem113c,
  targetStatId: number,
  tables: DropTables,
): number {
  const baseMeta = getItemBaseEquipMeta113c(item.code)
  const hostCategory = resolveHostSocketCategory113c(baseMeta)
  let total = extractOwnStatSum113c(item, targetStatId).sum
  const rawSockets = (item.rawItemData as { readonly socketedItems?: readonly EquipCandidateItem113c[] } | undefined)
    ?.socketedItems
  const children =
    item.socketedItems && item.socketedItems.length > 0
      ? item.socketedItems
      : Array.isArray(rawSockets)
        ? rawSockets
        : []
  for (const child of children) {
    const childOwn = extractOwnStatSum113c(child, targetStatId)
    if (childOwn.hasAnyExplicitStats) {
      total += childOwn.sum
    } else {
      total += resolveSocketChildGemStat113c(child.code, hostCategory, targetStatId, tables)
    }
  }
  return total
}

function inferUpgradedUniqueOrSetLevelPenalty113c(
  item: EquipCandidateItem113c,
  baseMeta: ItemBaseEquipMeta113c | undefined,
  tables: DropTables,
): number {
  if (!baseMeta) return 0
  const raw = (item.rawItemData ?? item) as Record<string, unknown>
  const quality = item.quality ?? raw.quality
  let origCode = ''
  if (quality === 7 || quality === 'unique') {
    const uid = typeof raw.uniqueItemId === 'number' ? raw.uniqueItemId : typeof raw.uniqueId === 'number' ? raw.uniqueId : undefined
    const uDef =
      uid !== undefined && tables.uniques
        ? ((tables.uniques as unknown as { byId?: ReadonlyMap<number, { code?: string }> }).byId?.get(uid) ??
          tables.uniques.all?.[uid])
        : undefined
    origCode = (uDef?.code ?? '').trim()
  } else if (quality === 5 || quality === 'set') {
    const sid = typeof raw.setItemId === 'number' ? raw.setItemId : typeof raw.setId === 'number' ? raw.setId : undefined
    const sDef =
      sid !== undefined && tables.sets?.items
        ? (tables.sets.items.getById?.(sid) ?? tables.sets.items.entries?.[sid])
        : undefined
    origCode = (sDef?.item ?? '').trim()
  }
  if (!origCode || origCode === baseMeta.code) return 0
  if (origCode === baseMeta.normCode && baseMeta.code === baseMeta.uberCode) return 5
  if (origCode === baseMeta.uberCode && baseMeta.code === baseMeta.ultraCode) return 7
  if (origCode === baseMeta.normCode && baseMeta.code === baseMeta.ultraCode) return 12
  return 0
}

function isItemEthereal113c(item: EquipCandidateItem113c): boolean {
  if (item.ethereal === true) return true
  const raw = item.rawItemData as
    | { readonly ethereal?: boolean; readonly flags?: { readonly ethereal?: boolean } }
    | undefined
  return raw?.ethereal === true || raw?.flags?.ethereal === true
}

function isItemUnidentified113c(item: EquipCandidateItem113c): boolean {
  if (item.identified === false) return true
  const raw = item.rawItemData as
    | { readonly identified?: boolean; readonly flags?: { readonly identified?: boolean } }
    | undefined
  return raw?.identified === false || raw?.flags?.identified === false
}

function isItemBroken113c(item: EquipCandidateItem113c): boolean {
  if (item.broken === true) return true
  const raw = item.rawItemData as
    | { readonly broken?: boolean; readonly flags?: { readonly broken?: boolean } }
    | undefined
  return raw?.broken === true || raw?.flags?.broken === true
}

/**
 * Computes the effective 1.13c `{ reqLevel, reqStr, reqDex }` of `item` per
 * `D2Common.dll` `#10244` (`0x6FD76DB0`) and `#11015` (`0x6FD76190`).
 */
export function computeItemRequirements113c(
  item: EquipCandidateItem113c,
  options?: {
    readonly dropTables?: DropTables | undefined
    readonly playerClass?: CharacterClassCode | undefined
    readonly includeWeaponSwap?: boolean | undefined
  },
): ComputedItemRequirements113c {
  const tables = options?.dropTables ?? getEmbeddedDropTables()
  const baseMeta = getItemBaseEquipMeta113c(item.code)
  const typeMeta = baseMeta ? getItemTypeEquipMeta113c(baseMeta.type) : undefined
  const validSlots = resolveValidBodySlotsForType113c(
    typeMeta,
    options?.includeWeaponSwap ?? true,
  )

  const baseReqStr = baseMeta?.reqStr ?? 0
  const baseReqDex = baseMeta?.reqDex ?? 0
  const easePercent = sumItemAndSocketsStat113c(item, 91, tables)
  const isEthereal = isItemEthereal113c(item)

  // D2Common.#10244 (0x6FD76DB0):
  //   delta = trunc(base * easePct / 100) + (ethereal ? -10 : 0)
  //   req = base > 0 ? max(0, base + delta) : 0
  const strDelta = Math.trunc((baseReqStr * easePercent) / 100) + (isEthereal ? -10 : 0)
  const dexDelta = Math.trunc((baseReqDex * easePercent) / 100) + (isEthereal ? -10 : 0)
  const reqStr = baseReqStr > 0 ? Math.max(0, baseReqStr + strDelta) : 0
  const reqDex = baseReqDex > 0 ? Math.max(0, baseReqDex + dexDelta) : 0

  // D2Common.#11015 (0x6FD76190):
  const rawItemRecord = item.rawItemData as Record<string, unknown> | undefined
  const rawForReq: Record<string, unknown> = {
    ...(rawItemRecord ?? {}),
    code: item.code,
    ...(item.quality !== undefined && rawItemRecord?.quality === undefined
      ? { quality: item.quality }
      : {}),
    ...(item.identified !== undefined && rawItemRecord?.identified === undefined
      ? { identified: item.identified }
      : {}),
    ...(item.reqLevel !== undefined ? { reqLevel: item.reqLevel } : {}),
  }
  if (!Array.isArray(rawForReq.stats)) {
    if (item.stats instanceof Map) {
      const arr: EquipStatEntry113c[] = []
      for (const [statId, value] of item.stats.entries()) {
        arr.push({ statId, param: 0, value })
      }
      rawForReq.stats = arr
    } else if (Array.isArray(item.stats)) {
      rawForReq.stats = item.stats
    }
  }
  if (!Array.isArray(rawForReq.runewordStats) && Array.isArray(item.runewordStats)) {
    rawForReq.runewordStats = item.runewordStats
  }

  const rawSockets = (item.rawItemData as { readonly socketedItems?: readonly EquipCandidateItem113c[] } | undefined)
    ?.socketedItems
  const children =
    item.socketedItems && item.socketedItems.length > 0
      ? item.socketedItems
      : Array.isArray(rawSockets)
        ? rawSockets
        : []
  const childRecords = children.map((c) => (c.rawItemData ?? (c as unknown as Record<string, unknown>)))

  let reqLevel = resolveOnlineItemReqLevel(
    rawForReq,
    childRecords,
    tables,
    options?.playerClass,
  )
  if (baseMeta && baseMeta.levelReq > reqLevel) {
    reqLevel = baseMeta.levelReq
  }
  for (const child of children) {
    const cCode = child.code.trim().toLowerCase()
    const cBase = getItemBaseEquipMeta113c(child.code)
    const cGemReq = GEM_INFO[cCode]?.reqLevel ?? RUNE_INFO[cCode]?.reqLevel ?? 0
    const cChildReq = computeItemRequirements113c(child, {
      dropTables: tables,
      playerClass: options?.playerClass,
    }).reqLevel
    reqLevel = Math.max(reqLevel, cBase?.levelReq ?? 0, cGemReq, cChildReq)
  }

  // If upgraded Unique/Set lacks explicit stat 92 (`item_levelreq`), apply +5 / +7 / +12 tier penalty.
  const explicitStat92 = extractOwnStatSum113c(item, 92).sum
  if (explicitStat92 === 0) {
    const inferredUpgradePenalty = inferUpgradedUniqueOrSetLevelPenalty113c(item, baseMeta, tables)
    if (inferredUpgradePenalty > 0) {
      reqLevel += inferredUpgradePenalty
    }
  }

  return {
    reqLevel: Math.max(0, Math.trunc(reqLevel)),
    reqStr,
    reqDex,
    baseReqStr,
    baseReqDex,
    easePercent,
    isEthereal,
    ...(typeMeta?.classOnly !== undefined ? { classOnly: typeMeta.classOnly } : {}),
    validSlots,
  }
}

function isHandSlot113c(slot: number): boolean {
  return slot === 4 || slot === 5 || slot === 11 || slot === 12
}

function oppositeHandSlot113c(slot: number): number | undefined {
  if (slot === 4) return 5
  if (slot === 5) return 4
  if (slot === 11) return 12
  if (slot === 12) return 11
  return undefined
}

function isMercenaryItemTypeAllowedInSlot113c(
  mercAct: 1 | 2 | 3 | 5,
  baseMeta: ItemBaseEquipMeta113c,
  typeMeta: ItemTypeEquipMeta113c,
  targetSlot: number,
): boolean {
  const t = baseMeta.type
  if (targetSlot === 1) {
    if (typeMeta.classOnly !== undefined) {
      return mercAct === 5 && typeMeta.classOnly === 'bar' && itemTypeIsA(t, 'phlm')
    }
    return itemTypeIsA(t, 'helm') || itemTypeIsA(t, 'circ')
  }
  if (targetSlot === 3) {
    if (typeMeta.classOnly !== undefined) return false
    return itemTypeIsA(t, 'tors')
  }
  if (targetSlot === 4 || targetSlot === 5) {
    if (typeMeta.classOnly !== undefined) return false
    if (mercAct === 1) {
      return itemTypeIsA(t, 'bow')
    }
    if (mercAct === 2) {
      return itemTypeIsA(t, 'pole') || itemTypeIsA(t, 'spea') || itemTypeIsA(t, 'jave')
    }
    if (mercAct === 3) {
      if (itemTypeIsA(t, 'shie')) return true
      return itemTypeIsA(t, 'swor') && !baseMeta.twoHanded
    }
    if (mercAct === 5) {
      return itemTypeIsA(t, 'swor')
    }
  }
  return false
}

/**
 * Returns `true` iff `itemA` and `itemB` can simultaneously occupy main-hand and off-hand
 * (`4` & `5`, or swap `11` & `12`) on `unit` in vanilla Diablo II v1.13c.
 */
export function canHandItemsCoexist113c(
  unit: EquipUnitContext113c,
  itemABase: ItemBaseEquipMeta113c,
  itemAType: ItemTypeEquipMeta113c,
  itemBBase: ItemBaseEquipMeta113c,
  itemBType: ItemTypeEquipMeta113c,
): boolean {
  const tA = itemABase.type
  const tB = itemBBase.type

  const aIsQuiver = itemAType.quiver !== ''
  const bIsQuiver = itemBType.quiver !== ''
  const aIsShield = itemTypeIsA(tA, 'shld')
  const bIsShield = itemTypeIsA(tB, 'shld')

  // Never two shields or two quivers.
  if (aIsShield && bIsShield) return false
  if (aIsQuiver && bIsQuiver) return false

  // Mercenary hand coexistence: only Act 3 Iron Wolf can hold 1H sword + shield.
  if (unit.kind === 'mercenary') {
    if (unit.mercAct !== 3) return false
    const a1hSword = itemTypeIsA(tA, 'swor') && !itemABase.twoHanded
    const b1hSword = itemTypeIsA(tB, 'swor') && !itemBBase.twoHanded
    return (a1hSword && bIsShield) || (b1hSword && aIsShield)
  }

  // Missile weapons (`Shoots = bowq` or `xboq`) have `2handed = 1` in `Weapons.txt`:
  // they ONLY coexist with their matching quiver type (`bow` + `bowq`, `xbow` + `xboq`).
  if (itemAType.shoots !== '') {
    return itemTypeIsA(tB, itemAType.shoots)
  }
  if (itemBType.shoots !== '') {
    return itemTypeIsA(tA, itemBType.shoots)
  }

  // Quivers cannot pair with strict 2H melee weapons; with 1H weapons/shields:
  // in 1.13c a quiver only pairs with its matching missile weapon (`Quiver = bow` / `xbow`)
  // or a non-2H item? Wait: in 1.13c D2Common `ITEMS_CanEquip` (`0x6FD77160`), `Quiver` column
  // requires the opposite hand to either be empty or match `Quiver` (`bow` for `bowq`, `xbow` for `xboq`)
  // — equipping a sword or shield while holding arrows displaces the arrows!
  if (aIsQuiver) {
    return itemTypeIsA(tB, itemAType.quiver)
  }
  if (bIsQuiver) {
    return itemTypeIsA(tA, itemBType.quiver)
  }

  const isBarb = unit.classCode === 'bar'
  const aStrict2H = itemABase.twoHanded && !(isBarb && itemABase.oneOrTwoHanded)
  const bStrict2H = itemBBase.twoHanded && !(isBarb && itemBBase.oneOrTwoHanded)
  if (aStrict2H || bStrict2H) return false

  // 1H weapon (including Barbarian 1H-ing a `1or2handed` sword) + Shield is valid for all classes.
  if ((aIsShield && !bIsShield) || (bIsShield && !aIsShield)) {
    return true
  }

  // Remaining case: two weapons (dual-wielding).
  // Only Barbarian (any two non-strict-2H melee/throwing weapons) and Assassin (two `h2h` claws) can dual-wield!
  if (isBarb) {
    return true
  }
  if (unit.classCode === 'ass') {
    return itemTypeIsA(tA, 'h2h') && itemTypeIsA(tB, 'h2h')
  }
  return false
}

function defaultComputeAttributesWithoutDisplaced113c(
  unit: EquipUnitContext113c,
  currentlyEquipped: readonly EquipCandidateItem113c[],
  displacedItems: readonly EquipCandidateItem113c[],
  tables: DropTables,
): { readonly strength: number; readonly dexterity: number } {
  const displacedSet = new Set<EquipCandidateItem113c>(displacedItems)
  let itemStr = 0
  let itemDex = 0
  for (const eq of currentlyEquipped) {
    if (displacedSet.has(eq)) continue
    if (eq.bodyLoc === 11 || eq.bodyLoc === 12) continue
    if (isItemUnidentified113c(eq) || isItemBroken113c(eq)) continue
    itemStr += sumItemAndSocketsStat113c(eq, 0, tables)
    const strPerLvl = sumItemAndSocketsStat113c(eq, 220, tables)
    if (strPerLvl !== 0) itemStr += (strPerLvl * unit.level) >> 3
    itemDex += sumItemAndSocketsStat113c(eq, 2, tables)
    const dexPerLvl = sumItemAndSocketsStat113c(eq, 222, tables)
    if (dexPerLvl !== 0) itemDex += (dexPerLvl * unit.level) >> 3
  }
  return {
    strength: unit.baseStrength + (unit.bonusStrength ?? 0) + itemStr,
    dexterity: unit.baseDexterity + (unit.bonusDexterity ?? 0) + itemDex,
  }
}

/**
 * Authoritative 1.13c server-side equip validator (`D2Common.dll` `#10244` `0x6FD76DB0`,
 * `#10751` `0x6FD77160`, `#11015` `0x6FD76190`).
 */
export function canUnitEquipItem113c<T extends EquipCandidateItem113c>(
  unit: EquipUnitContext113c,
  item: T,
  targetSlot: number,
  currentlyEquipped: readonly T[],
  options?: CanUnitEquipOptions113c<T>,
): CanUnitEquipResult113c<T> {
  const tables = options?.dropTables ?? getEmbeddedDropTables()
  const includeWeaponSwap = unit.kind === 'player'
  const requirements = computeItemRequirements113c(item, {
    dropTables: tables,
    playerClass: unit.classCode,
    includeWeaponSwap,
  })
  const fallbackEffective = () =>
    options?.computeAttributesWithoutDisplaced
      ? options.computeAttributesWithoutDisplaced([])
      : defaultComputeAttributesWithoutDisplaced113c(unit, currentlyEquipped, [], tables)

  const reject = (
    reason: EquipRejectReason113c,
    eff?: { readonly strength: number; readonly dexterity: number },
    displacedTargetItem?: T,
    displacedOppositeItem?: T,
  ): CanUnitEquipResult113c<T> => {
    const resolvedEff = eff ?? fallbackEffective()
    const displacedItems: T[] = []
    if (displacedTargetItem !== undefined) displacedItems.push(displacedTargetItem)
    if (displacedOppositeItem !== undefined && displacedOppositeItem !== displacedTargetItem) {
      displacedItems.push(displacedOppositeItem)
    }
    return {
      allowed: false,
      reason,
      requirements,
      effectiveUnitStats: {
        level: unit.level,
        strength: resolvedEff.strength,
        dexterity: resolvedEff.dexterity,
      },
      ...(displacedTargetItem !== undefined ? { displacedTargetItem } : {}),
      ...(displacedOppositeItem !== undefined ? { displacedOppositeItem } : {}),
      displacedItems,
    }
  }

  const baseMeta = getItemBaseEquipMeta113c(item.code)
  if (!baseMeta) return reject('unknown_item')
  const typeMeta = getItemTypeEquipMeta113c(baseMeta.type)
  if (!typeMeta || !typeMeta.body || requirements.validSlots.length === 0) {
    return reject('not_equippable')
  }

  if (isItemUnidentified113c(item)) {
    return reject('unidentified')
  }
  if (isItemBroken113c(item)) {
    return reject('broken')
  }

  if (unit.kind === 'mercenary') {
    if (targetSlot !== 1 && targetSlot !== 3 && targetSlot !== 4 && targetSlot !== 5) {
      return reject('invalid_merc_slot')
    }
    const mercAct = unit.mercAct ?? 2
    if (!isMercenaryItemTypeAllowedInSlot113c(mercAct, baseMeta, typeMeta, targetSlot)) {
      return reject(
        requirements.classOnly !== undefined &&
          !(mercAct === 5 && requirements.classOnly === 'bar' && targetSlot === 1)
          ? 'wrong_class'
          : 'invalid_merc_type',
      )
    }
  } else {
    if (!requirements.validSlots.includes(targetSlot)) {
      return reject('invalid_slot')
    }
    if (
      requirements.classOnly !== undefined &&
      unit.classCode !== undefined &&
      unit.classCode !== requirements.classOnly
    ) {
      return reject('wrong_class')
    }
  }

  const displacedTargetItem = currentlyEquipped.find(
    (eq) => eq !== item && eq.bodyLoc === targetSlot,
  )
  let displacedOppositeItem: T | undefined

  if (isHandSlot113c(targetSlot)) {
    const oppSlot = oppositeHandSlot113c(targetSlot)!
    const oppItem = currentlyEquipped.find((eq) => eq !== item && eq.bodyLoc === oppSlot)
    if (oppItem !== undefined) {
      const oppBase = getItemBaseEquipMeta113c(oppItem.code)
      const oppType = oppBase ? getItemTypeEquipMeta113c(oppBase.type) : undefined
      const coexists =
        oppBase !== undefined &&
        oppType !== undefined &&
        canHandItemsCoexist113c(unit, baseMeta, typeMeta, oppBase, oppType)
      if (!coexists) {
        if (options?.strictSlotConflict === true) {
          return reject('opposite_hand_conflict', undefined, displacedTargetItem, oppItem)
        }
        displacedOppositeItem = oppItem
      }
    }
  }

  const displacedItems: T[] = []
  if (displacedTargetItem !== undefined) displacedItems.push(displacedTargetItem)
  if (displacedOppositeItem !== undefined && displacedOppositeItem !== displacedTargetItem) {
    displacedItems.push(displacedOppositeItem)
  }

  const effAttrs = options?.computeAttributesWithoutDisplaced
    ? options.computeAttributesWithoutDisplaced(displacedItems)
    : defaultComputeAttributesWithoutDisplaced113c(unit, currentlyEquipped, displacedItems, tables)

  if (unit.level < requirements.reqLevel) {
    return reject('level_too_low', effAttrs, displacedTargetItem, displacedOppositeItem)
  }
  if (effAttrs.strength < requirements.reqStr) {
    return reject('strength_too_low', effAttrs, displacedTargetItem, displacedOppositeItem)
  }
  if (effAttrs.dexterity < requirements.reqDex) {
    return reject('dexterity_too_low', effAttrs, displacedTargetItem, displacedOppositeItem)
  }

  return {
    allowed: true,
    requirements,
    effectiveUnitStats: {
      level: unit.level,
      strength: effAttrs.strength,
      dexterity: effAttrs.dexterity,
    },
    ...(displacedTargetItem !== undefined ? { displacedTargetItem } : {}),
    ...(displacedOppositeItem !== undefined ? { displacedOppositeItem } : {}),
    displacedItems,
  }
}
