/**
 * Item Drop Tracker core domain, classification, session deduplication, and IndexedDB +
 * localStorage + BroadcastChannel persistence (`plugins/drop-tracker/drop-tracker.ts`).
 *
 * Tracks ground drops of:
 * - Set items (`quality === 5` / `'set'`)
 * - Unique items (`quality === 7` / `'unique'`)
 * - Runes (`code` matching `r01`–`r33`, case-insensitive)
 */

import type { PluginLogger, PluginSessionView } from '../../src/client/plugin-host/api.ts'
import {
  CANONICAL_CHI_TBL_DICT,
  CANONICAL_ENG_TBL_DICT,
} from '../../src/common/data/canonical-tbl-strings.ts'
import { BAKED_UI_MANIFEST } from '../../src/common/items/baked-ui-meta.ts'
import { getEmbeddedDropTables } from '../../src/common/items/embedded-drop-tables.ts'
import { resolveItemInvFile } from '../../src/common/items/item-bridge.ts'
import { ItemQuality, type Item } from '../../src/common/items/items.ts'
import { LEVEL_NAMES_ZH, levelDisplayName } from '../../src/common/world/level-names-zh.ts'
import type { ServerEvent } from '../../src/netproto/index.ts'

export type DropCategory = 'set' | 'unique' | 'rune'

export type DropEquipmentTier = 'normal' | 'exceptional' | 'elite'

export interface DropSpriteRect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export const DROP_ITEMS_ATLAS_URL = '/ui/items-atlas.png'

export interface DropRecord {
  readonly id?: number | undefined
  readonly timestamp: number
  readonly itemId: number
  readonly code: string
  readonly name: string
  readonly nameZh: string
  readonly category: DropCategory
  readonly areaId: number
  readonly areaNameZh: string
  readonly areaNameEn?: string | undefined
  readonly quality?: number | undefined
  readonly setItemId?: number | undefined
  readonly uniqueItemId?: number | undefined
}

export interface DropStatsSummary {
  readonly setCount: number
  readonly uniqueCount: number
  readonly runeCount: number
  readonly totalTracked: number
  readonly records: readonly DropRecord[]
}

export interface DropItemBreakdownEntry {
  readonly code: string
  readonly name: string
  readonly nameZh: string
  readonly category: DropCategory
  readonly count: number
  readonly lastTimestamp: number
  readonly lastAreaId: number
  readonly lastAreaNameZh: string
}

export interface DropGrailSetPieceEntry {
  readonly id: number
  readonly index: string
  readonly setKey: string
  readonly code: string
  readonly name: string
  readonly nameZh: string
  readonly baseName: string
  readonly baseNameZh: string
  readonly lvl: number
  readonly lvlReq: number
  readonly invWidth: number
  readonly invHeight: number
  readonly invFile: string
  readonly invtransform?: string | undefined
  readonly spriteRect: DropSpriteRect
  readonly count: number
  readonly lit: boolean
  readonly lastTimestamp: number
  readonly lastAreaNameZh: string
}

export interface DropGrailSetGroup {
  readonly id: number
  readonly index: string
  readonly name: string
  readonly nameZh: string
  readonly pieces: readonly DropGrailSetPieceEntry[]
  readonly litPieces: number
  readonly totalPieces: number
  readonly totalDrops: number
  readonly completed: boolean
}

export interface DropGrailUniqueItemEntry {
  readonly id: number
  readonly ids: readonly number[]
  readonly index: string
  readonly code: string
  readonly name: string
  readonly nameZh: string
  readonly baseName: string
  readonly baseNameZh: string
  readonly baseType: string
  readonly tier: DropEquipmentTier
  readonly tierRank: 0 | 1 | 2
  readonly tierLabelZh: '普通' | '扩展' | '精英'
  readonly tierLabelEn: 'Normal' | 'Exceptional' | 'Elite'
  readonly lvl: number
  readonly lvlReq: number
  readonly invWidth: number
  readonly invHeight: number
  readonly invFile: string
  readonly invtransform?: string | undefined
  readonly spriteRect: DropSpriteRect
  readonly count: number
  readonly lit: boolean
  readonly lastTimestamp: number
  readonly lastAreaNameZh: string
}

export interface DropGrailUniqueTypeGroup {
  readonly baseType: string
  readonly typeNameZh: string
  readonly typeNameEn: string
  readonly hasEquipmentTiers: boolean
  readonly items: readonly DropGrailUniqueItemEntry[]
  readonly litItems: number
  readonly totalItems: number
  readonly totalDrops: number
}

export interface DropGrailRuneEntry {
  readonly runeNumber: number
  readonly code: string
  readonly name: string
  readonly nameZh: string
  readonly invFile: string
  readonly spriteRect: DropSpriteRect
  readonly count: number
  readonly lit: boolean
  readonly lastTimestamp: number
  readonly lastAreaNameZh: string
}

export interface DropGrailCatalog {
  readonly sets: readonly DropGrailSetGroup[]
  readonly uniqueGroups: readonly DropGrailUniqueTypeGroup[]
  readonly runes: readonly DropGrailRuneEntry[]
  readonly litSetPieces: number
  readonly totalSetPieces: number
  readonly completedSets: number
  readonly totalSets: number
  readonly litUniqueItems: number
  readonly totalUniqueItems: number
  readonly litRunes: number
  readonly totalRunes: number
}

export interface DropCandidateItem {
  readonly id?: number | undefined
  readonly itemId?: number | undefined
  readonly code?: string | undefined
  readonly rawCode?: string | undefined
  readonly name?: string | undefined
  readonly nameZh?: string | undefined
  readonly quality?: number | string | undefined
  readonly action?: number | string | undefined
  readonly container?: string | undefined
  readonly location?: number | undefined
  readonly setItemId?: number | undefined
  readonly uniqueItemId?: number | undefined
}

export interface DropCandidateEvent {
  readonly type?: string | undefined
  readonly action?: number | string | undefined
  readonly container?: string | undefined
  readonly destination?: string | undefined
  readonly areaId?: number | undefined
  readonly timestamp?: number | undefined
  readonly item?: DropCandidateItem | undefined
}

export interface DropStatsRepository {
  loadAll(): Promise<readonly DropRecord[]>
  append(record: DropRecord): Promise<DropRecord>
  clear(): Promise<void>
  getSnapshotSync(): DropStatsSummary
}

export const DROP_TRACKER_DB_NAME = 'd2-drop-tracker-db'
export const DROP_TRACKER_DB_VERSION = 1
export const DROP_TRACKER_STORE_NAME = 'drops'
export const DROP_TRACKER_STORAGE_KEY = 'd2-drop-tracker-snapshot-v1'
export const DROP_TRACKER_CHANNEL_NAME = 'd2-drop-tracker'

const RUNE_CODE_RE = /^r(0[1-9]|[12][0-9]|3[0-3])$/i

const GROUND_ACTION_CODES = new Set<number>([
  0x00, // add_to_ground
  0x02, // drop_to_ground
  0x03, // on_ground
])

const GROUND_ACTION_NAMES = new Set<string>([
  'add_to_ground',
  'drop_to_ground',
  'on_ground',
  'ground',
])

/**
 * Checks whether an item code is a canonical 1.13c rune code (`r01` through `r33`).
 */
export function isRuneCode(code: string | undefined | null): boolean {
  if (typeof code !== 'string') return false
  return RUNE_CODE_RE.test(code.trim())
}

/**
 * Classifies an item into `'rune' | 'set' | 'unique'`, or `null` if untracked.
 * - Rune (`r01`..`r33`) takes precedence regardless of quality field.
 * - Set: `quality === 5` or `'set'`.
 * - Unique: `quality === 7` or `'unique'`.
 */
export function classifyDropItem(
  item:
    | {
        readonly code?: string | undefined
        readonly rawCode?: string | undefined
        readonly quality?: number | string | undefined
      }
    | null
    | undefined,
): DropCategory | null {
  if (!item || typeof item !== 'object') return null
  const rawCode = typeof item.code === 'string' && item.code.trim().length > 0
    ? item.code.trim()
    : typeof item.rawCode === 'string'
      ? item.rawCode.trim()
      : ''
  if (isRuneCode(rawCode)) {
    return 'rune'
  }
  const q = item.quality
  if (q === 5 || (typeof q === 'string' && q.toLowerCase() === 'set')) {
    return 'set'
  }
  if (q === 7 || (typeof q === 'string' && q.toLowerCase() === 'unique')) {
    return 'unique'
  }
  return null
}

/**
 * Checks whether a server/session event represents an item appearing or dropping on the ground.
 * Accepts both canonical `ServerEvent` (`type: 'ItemEvent'`) and unit-test `ItemAction` payloads.
 */
export function isGroundDropEvent(ev: unknown): boolean {
  if (!ev || typeof ev !== 'object') return false
  const candidate = ev as DropCandidateEvent
  if (
    candidate.type !== undefined &&
    candidate.type !== 'ItemEvent' &&
    candidate.type !== 'ItemAction'
  ) {
    return false
  }
  const item = candidate.item
  if (!item || typeof item !== 'object') return false

  const itemDest = (item as { readonly destination?: string | number | undefined }).destination
  const containerRaw =
    candidate.container ?? item.container ?? candidate.destination ?? itemDest
  if (typeof containerRaw === 'string') {
    if (containerRaw.toLowerCase() !== 'ground') {
      return false
    }
  } else if (typeof containerRaw === 'number') {
    // D2GS 0x9C destination 3 = ground
    if (containerRaw !== 3) {
      return false
    }
  } else if (item.location !== undefined) {
    // D2GS location 0 = ground when container string is omitted
    if (item.location !== 0) {
      return false
    }
  } else {
    return false
  }

  const action = candidate.action !== undefined ? candidate.action : item.action
  if (typeof action === 'number') {
    return GROUND_ACTION_CODES.has(action)
  }
  if (typeof action === 'string') {
    return GROUND_ACTION_NAMES.has(action.toLowerCase())
  }
  // If container is explicitly 'ground' and no action was specified in a synthetic test payload
  return containerRaw === 'ground'
}

let uniqueIndexById: ReadonlyMap<number, string> | null = null
let setIndexById: ReadonlyMap<number, string> | null = null
let singleUniqueIndexByCode: ReadonlyMap<string, string> | null = null
let singleSetIndexByCode: ReadonlyMap<string, string> | null = null

function getUniqueIndexMap(): ReadonlyMap<number, string> {
  if (uniqueIndexById) return uniqueIndexById
  const map = new Map<number, string>()
  try {
    const tables = getEmbeddedDropTables()
    for (const list of tables.uniques.byCode.values()) {
      for (const u of list) {
        map.set(u.id, u.index.trim())
      }
    }
  } catch {
    // Fallback to empty map if embedded tables are unavailable
  }
  uniqueIndexById = map
  return map
}

function getSetIndexMap(): ReadonlyMap<number, string> {
  if (setIndexById) return setIndexById
  const map = new Map<number, string>()
  try {
    const tables = getEmbeddedDropTables()
    for (const s of tables.sets.items.entries) {
      map.set(s.id, s.index.trim())
    }
  } catch {
    // Fallback to empty map if embedded tables are unavailable
  }
  setIndexById = map
  return map
}

function getSingleUniqueIndexByCodeMap(): ReadonlyMap<string, string> {
  if (singleUniqueIndexByCode) return singleUniqueIndexByCode
  const map = new Map<string, string>()
  try {
    const tables = getEmbeddedDropTables()
    for (const [code, list] of tables.uniques.byCode.entries()) {
      const enabled = list.filter((u) => u.enabled)
      const distinctIndices = new Set(enabled.map((u) => u.index.trim()))
      if (distinctIndices.size === 1) {
        const [onlyIndex] = distinctIndices
        if (onlyIndex) {
          map.set(code.trim().toLowerCase(), onlyIndex)
        }
      }
    }
  } catch {
    // Ignore fallback
  }
  singleUniqueIndexByCode = map
  return map
}

function getSingleSetIndexByCodeMap(): ReadonlyMap<string, string> {
  if (singleSetIndexByCode) return singleSetIndexByCode
  const map = new Map<string, string>()
  try {
    const tables = getEmbeddedDropTables()
    const byCode = new Map<string, Set<string>>()
    for (const s of tables.sets.items.entries) {
      const c = s.item.trim().toLowerCase()
      const set = byCode.get(c) ?? new Set<string>()
      set.add(s.index.trim())
      byCode.set(c, set)
    }
    for (const [code, indices] of byCode.entries()) {
      if (indices.size === 1) {
        const [onlyIndex] = indices
        if (onlyIndex) {
          map.set(code, onlyIndex)
        }
      }
    }
  } catch {
    // Ignore fallback
  }
  singleSetIndexByCode = map
  return map
}

function lookupTblEn(key: string | undefined): string | undefined {
  if (!key) return undefined
  const raw = CANONICAL_ENG_TBL_DICT[key] ?? CANONICAL_ENG_TBL_DICT[key.trim()]
  return raw ? raw.replace(/\r?\n/g, ' ').trim() : undefined
}

function lookupTblZh(key: string | undefined): string | undefined {
  if (!key) return undefined
  const raw = CANONICAL_CHI_TBL_DICT[key] ?? CANONICAL_CHI_TBL_DICT[key.trim()]
  return raw ? raw.replace(/\r?\n/g, ' ').trim() : undefined
}

/**
 * Resolves localized English and Chinese item names from 1.13c string tables.
 */
export function resolveDropItemNames(item: DropCandidateItem): {
  readonly code: string
  readonly name: string
  readonly nameZh: string
} {
  const rawCode = (item.code ?? item.rawCode ?? '').trim()
  const lookupCode = rawCode.replace(/\0+$/g, '').trim()
  const lowerCode = lookupCode.toLowerCase()
  const normalizedCode = isRuneCode(lookupCode) ? lowerCode : lookupCode
  const category = classifyDropItem(item)

  let tblKey: string | undefined
  if (typeof item.uniqueItemId === 'number' && item.uniqueItemId >= 0) {
    tblKey = getUniqueIndexMap().get(item.uniqueItemId)
  } else if (typeof item.setItemId === 'number' && item.setItemId >= 0) {
    tblKey = getSetIndexMap().get(item.setItemId)
  } else if (category === 'unique') {
    tblKey = getSingleUniqueIndexByCodeMap().get(lowerCode)
  } else if (category === 'set') {
    tblKey = getSingleSetIndexByCodeMap().get(lowerCode)
  }

  const baseEn =
    lookupTblEn(tblKey) ??
    lookupTblEn(normalizedCode) ??
    lookupTblEn(lowerCode) ??
    tblKey ??
    (normalizedCode || 'Unknown Item')

  const baseZh =
    lookupTblZh(tblKey) ??
    lookupTblZh(normalizedCode) ??
    lookupTblZh(lowerCode) ??
    baseEn

  const cleanEn = typeof item.name === 'string' && item.name.trim().length > 0
    ? item.name.trim()
    : baseEn
  const cleanZh = typeof item.nameZh === 'string' && item.nameZh.trim().length > 0
    ? item.nameZh.trim()
    : baseZh

  return {
    code: normalizedCode,
    name: cleanEn,
    nameZh: cleanZh,
  }
}

export function resolveDropAreaNameZh(areaId: number): string {
  if (!Number.isFinite(areaId) || areaId <= 0) {
    return '未知区域'
  }
  const id = Math.trunc(areaId)
  return LEVEL_NAMES_ZH[id] ?? levelDisplayName(id, 'zh')
}

export function resolveDropAreaNameEn(areaId: number): string {
  if (!Number.isFinite(areaId) || areaId <= 0) {
    return 'Unknown Area'
  }
  const id = Math.trunc(areaId)
  return levelDisplayName(id, 'en')
}

export function summarizeDropRecords(records: readonly DropRecord[]): DropStatsSummary {
  let setCount = 0
  let uniqueCount = 0
  let runeCount = 0
  for (const r of records) {
    if (r.category === 'set') setCount += 1
    else if (r.category === 'unique') uniqueCount += 1
    else if (r.category === 'rune') runeCount += 1
  }
  return {
    setCount,
    uniqueCount,
    runeCount,
    totalTracked: setCount + uniqueCount + runeCount,
    records: [...records],
  }
}

export function computeDropItemBreakdown(
  records: readonly DropRecord[],
  filterCategory?: DropCategory | 'all',
): readonly DropItemBreakdownEntry[] {
  const byKey = new Map<string, DropItemBreakdownEntry>()
  for (const r of records) {
    if (filterCategory && filterCategory !== 'all' && r.category !== filterCategory) {
      continue
    }
    const key = `${r.category}:${r.code}:${r.name}`
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, {
        code: r.code,
        name: r.name,
        nameZh: r.nameZh,
        category: r.category,
        count: 1,
        lastTimestamp: r.timestamp,
        lastAreaId: r.areaId,
        lastAreaNameZh: r.areaNameZh,
      })
    } else {
      const isNewer = r.timestamp >= prev.lastTimestamp
      byKey.set(key, {
        ...prev,
        count: prev.count + 1,
        lastTimestamp: isNewer ? r.timestamp : prev.lastTimestamp,
        lastAreaId: isNewer ? r.areaId : prev.lastAreaId,
        lastAreaNameZh: isNewer ? r.areaNameZh : prev.lastAreaNameZh,
      })
    }
  }
  return [...byKey.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    if (b.lastTimestamp !== a.lastTimestamp) return b.lastTimestamp - a.lastTimestamp
    return a.code.localeCompare(b.code)
  })
}

const UNIQUE_BASE_TYPE_METADATA: ReadonlyArray<{
  readonly baseType: string
  readonly typeNameZh: string
  readonly typeNameEn: string
  readonly hasEquipmentTiers: boolean
}> = [
  // Armor & Defense
  { baseType: 'helm', typeNameZh: '头盔', typeNameEn: 'Helms', hasEquipmentTiers: true },
  { baseType: 'circ', typeNameZh: '头环', typeNameEn: 'Circlets', hasEquipmentTiers: true },
  { baseType: 'tors', typeNameZh: '护甲', typeNameEn: 'Body Armor', hasEquipmentTiers: true },
  { baseType: 'shie', typeNameZh: '盾牌', typeNameEn: 'Shields', hasEquipmentTiers: true },
  { baseType: 'glov', typeNameZh: '手套', typeNameEn: 'Gloves', hasEquipmentTiers: true },
  { baseType: 'boot', typeNameZh: '靴子', typeNameEn: 'Boots', hasEquipmentTiers: true },
  { baseType: 'belt', typeNameZh: '腰带', typeNameEn: 'Belts', hasEquipmentTiers: true },
  // Weapons
  { baseType: 'axe', typeNameZh: '斧', typeNameEn: 'Axes', hasEquipmentTiers: true },
  { baseType: 'swor', typeNameZh: '剑', typeNameEn: 'Swords', hasEquipmentTiers: true },
  { baseType: 'knif', typeNameZh: '匕首', typeNameEn: 'Daggers', hasEquipmentTiers: true },
  { baseType: 'club', typeNameZh: '木棒', typeNameEn: 'Clubs', hasEquipmentTiers: true },
  { baseType: 'mace', typeNameZh: '钉锤', typeNameEn: 'Maces', hasEquipmentTiers: true },
  { baseType: 'hamm', typeNameZh: '战锤', typeNameEn: 'Hammers', hasEquipmentTiers: true },
  { baseType: 'scep', typeNameZh: '权杖', typeNameEn: 'Scepters', hasEquipmentTiers: true },
  { baseType: 'spea', typeNameZh: '长矛', typeNameEn: 'Spears', hasEquipmentTiers: true },
  { baseType: 'pole', typeNameZh: '长柄武器', typeNameEn: 'Polearms', hasEquipmentTiers: true },
  { baseType: 'jave', typeNameZh: '标枪', typeNameEn: 'Javelins', hasEquipmentTiers: true },
  { baseType: 'tkni', typeNameZh: '飞刀', typeNameEn: 'Throwing Knives', hasEquipmentTiers: true },
  { baseType: 'taxe', typeNameZh: '飞斧', typeNameEn: 'Throwing Axes', hasEquipmentTiers: true },
  { baseType: 'bow', typeNameZh: '弓', typeNameEn: 'Bows', hasEquipmentTiers: true },
  { baseType: 'xbow', typeNameZh: '十字弓', typeNameEn: 'Crossbows', hasEquipmentTiers: true },
  { baseType: 'staf', typeNameZh: '法杖', typeNameEn: 'Staves', hasEquipmentTiers: true },
  { baseType: 'wand', typeNameZh: '魔杖', typeNameEn: 'Wands', hasEquipmentTiers: true },
  // Class-Specific Equipment
  { baseType: 'abow', typeNameZh: '亚马逊弓', typeNameEn: 'Amazon Bows', hasEquipmentTiers: true },
  { baseType: 'aspe', typeNameZh: '亚马逊长矛', typeNameEn: 'Amazon Spears', hasEquipmentTiers: true },
  { baseType: 'ajav', typeNameZh: '亚马逊标枪', typeNameEn: 'Amazon Javelins', hasEquipmentTiers: true },
  { baseType: 'orb', typeNameZh: '法师法珠', typeNameEn: 'Sorceress Orbs', hasEquipmentTiers: true },
  { baseType: 'head', typeNameZh: '死灵法师防腐头颅', typeNameEn: 'Necromancer Heads', hasEquipmentTiers: true },
  { baseType: 'ashd', typeNameZh: '圣骑士盾牌', typeNameEn: 'Paladin Shields', hasEquipmentTiers: true },
  { baseType: 'phlm', typeNameZh: '野蛮人头盔', typeNameEn: 'Barbarian Helms', hasEquipmentTiers: true },
  { baseType: 'pelt', typeNameZh: '德鲁伊毛皮', typeNameEn: 'Druid Pelts', hasEquipmentTiers: true },
  { baseType: 'h2h', typeNameZh: '刺客爪', typeNameEn: 'Assassin Katars', hasEquipmentTiers: true },
  // Jewelry & Charms
  { baseType: 'ring', typeNameZh: '戒指', typeNameEn: 'Rings', hasEquipmentTiers: false },
  { baseType: 'amul', typeNameZh: '项链', typeNameEn: 'Amulets', hasEquipmentTiers: false },
  { baseType: 'jewl', typeNameZh: '珠宝', typeNameEn: 'Jewels', hasEquipmentTiers: false },
  { baseType: 'scha', typeNameZh: '小护身符', typeNameEn: 'Small Charms', hasEquipmentTiers: false },
  { baseType: 'mcha', typeNameZh: '大型护身符', typeNameEn: 'Large Charms', hasEquipmentTiers: false },
  { baseType: 'lcha', typeNameZh: '超大型护身符', typeNameEn: 'Grand Charms', hasEquipmentTiers: false },
]

export function resolveDropSpriteRect(params: {
  readonly code: string
  readonly name?: string | undefined
  readonly invFile?: string | undefined
  readonly invtransform?: string | undefined
}): DropSpriteRect {
  const itemRects = BAKED_UI_MANIFEST.itemRects
  const code = params.code.trim()
  const lowerCode = code.toLowerCase()
  const targetInv =
    params.invFile ||
    (params.name ? BAKED_UI_MANIFEST.codeToInvFile[params.name] : undefined) ||
    BAKED_UI_MANIFEST.codeToInvFile[code] ||
    BAKED_UI_MANIFEST.codeToInvFile[lowerCode]

  if (targetInv && params.invtransform) {
    const targetLower = targetInv.toLowerCase()
    const dyedKey = `${targetLower}_${params.invtransform.toLowerCase()}`
    if (itemRects[dyedKey]) return itemRects[dyedKey]!
    const exactDyed = `${targetInv}_${params.invtransform}`
    if (itemRects[exactDyed]) return itemRects[exactDyed]!
  }

  if (targetInv) {
    if (itemRects[targetInv]) return itemRects[targetInv]!
    const lowerInv = targetInv.toLowerCase()
    if (itemRects[lowerInv]) return itemRects[lowerInv]!
  }

  if (params.name) {
    const fromName = BAKED_UI_MANIFEST.codeToInvFile[params.name]
    if (fromName && itemRects[fromName]) return itemRects[fromName]!
  }

  const fromCode = BAKED_UI_MANIFEST.codeToInvFile[code] ?? BAKED_UI_MANIFEST.codeToInvFile[lowerCode]
  if (fromCode && itemRects[fromCode]) return itemRects[fromCode]!

  return itemRects['invcap'] ?? { x: 0, y: 0, w: 28, h: 28 }
}

interface StaticSetPieceBlueprint {
  readonly id: number
  readonly index: string
  readonly setKey: string
  readonly code: string
  readonly name: string
  readonly nameZh: string
  readonly baseName: string
  readonly baseNameZh: string
  readonly lvl: number
  readonly lvlReq: number
  readonly invWidth: number
  readonly invHeight: number
  readonly invFile: string
  readonly invtransform?: string | undefined
  readonly spriteRect: DropSpriteRect
}

interface StaticSetGroupBlueprint {
  readonly id: number
  readonly index: string
  readonly name: string
  readonly nameZh: string
  readonly pieces: readonly StaticSetPieceBlueprint[]
}

interface StaticUniqueItemBlueprint {
  readonly id: number
  readonly ids: readonly number[]
  readonly index: string
  readonly code: string
  readonly name: string
  readonly nameZh: string
  readonly baseName: string
  readonly baseNameZh: string
  readonly baseType: string
  readonly tier: DropEquipmentTier
  readonly tierRank: 0 | 1 | 2
  readonly tierLabelZh: '普通' | '扩展' | '精英'
  readonly tierLabelEn: 'Normal' | 'Exceptional' | 'Elite'
  readonly baseOrder: number
  readonly lvl: number
  readonly lvlReq: number
  readonly invWidth: number
  readonly invHeight: number
  readonly invFile: string
  readonly invtransform?: string | undefined
  readonly spriteRect: DropSpriteRect
}

interface StaticUniqueTypeGroupBlueprint {
  readonly baseType: string
  readonly typeNameZh: string
  readonly typeNameEn: string
  readonly hasEquipmentTiers: boolean
  readonly items: readonly StaticUniqueItemBlueprint[]
}

interface StaticRuneBlueprint {
  readonly runeNumber: number
  readonly code: string
  readonly name: string
  readonly nameZh: string
  readonly invFile: string
  readonly spriteRect: DropSpriteRect
}

interface StaticGrailBlueprint {
  readonly sets: readonly StaticSetGroupBlueprint[]
  readonly uniqueGroups: readonly StaticUniqueTypeGroupBlueprint[]
  readonly runes: readonly StaticRuneBlueprint[]
}

let cachedGrailBlueprint: StaticGrailBlueprint | null = null

function getStaticGrailBlueprint(): StaticGrailBlueprint {
  if (cachedGrailBlueprint) return cachedGrailBlueprint
  const tables = getEmbeddedDropTables()

  // Base item order map from canonical Weapons.txt, Armor.txt, Misc.txt
  const baseOrderMap = new Map<string, number>()
  let orderCounter = 0
  for (const b of tables.armor.all) baseOrderMap.set(b.code.trim().toLowerCase(), orderCounter++)
  for (const b of tables.weapons.all) baseOrderMap.set(b.code.trim().toLowerCase(), orderCounter++)
  for (const b of tables.misc.all) baseOrderMap.set(b.code.trim().toLowerCase(), orderCounter++)

  // 1. Build 32 Sets and 127 Set Pieces
  const piecesBySetKey = new Map<string, StaticSetPieceBlueprint[]>()
  for (const si of tables.sets.items.entries) {
    const code = si.item.trim()
    const lowerCode = code.toLowerCase()
    const base = tables.getBase(code) ?? tables.getBase(lowerCode)
    const cleanIndex = si.index.trim()
    const nameEn = lookupTblEn(cleanIndex) ?? cleanIndex
    const nameZh = lookupTblZh(cleanIndex) ?? nameEn
    const baseNameEn = lookupTblEn(code) ?? lookupTblEn(lowerCode) ?? base?.name ?? code
    const baseNameZh = lookupTblZh(code) ?? lookupTblZh(lowerCode) ?? baseNameEn

    const fakeItem = {
      id: si.id,
      code,
      name: cleanIndex,
      quality: ItemQuality.SET,
      identified: true,
      base,
      setItemDef: si,
      invWidth: base?.invWidth ?? 1,
      invHeight: base?.invHeight ?? 1,
    } as unknown as Item
    const invMeta = resolveItemInvFile(fakeItem, 'set', code, tables)
    const spriteRect = resolveDropSpriteRect({
      code,
      name: cleanIndex,
      invFile: invMeta.invFile,
      invtransform: invMeta.invtransform,
    })

    const piece: StaticSetPieceBlueprint = {
      id: si.id,
      index: cleanIndex,
      setKey: si.set.trim(),
      code,
      name: nameEn,
      nameZh,
      baseName: baseNameEn,
      baseNameZh,
      lvl: si.lvl,
      lvlReq: si.levelreq,
      invWidth: base?.invWidth ?? 1,
      invHeight: base?.invHeight ?? 1,
      invFile: invMeta.invFile,
      invtransform: invMeta.invtransform,
      spriteRect,
    }
    const list = piecesBySetKey.get(piece.setKey) ?? []
    list.push(piece)
    piecesBySetKey.set(piece.setKey, list)
  }

  const sets: StaticSetGroupBlueprint[] = tables.sets.sets.entries.map((setDef, setIdx) => {
    const setIndex = setDef.index.trim()
    const nameEn = lookupTblEn(setDef.name) ?? lookupTblEn(setIndex) ?? setDef.name
    const nameZh = lookupTblZh(setDef.name) ?? lookupTblZh(setIndex) ?? nameEn
    const pieces = piecesBySetKey.get(setIndex) ?? []
    return {
      id: setIdx,
      index: setIndex,
      name: nameEn,
      nameZh,
      pieces,
    }
  })

  // 2. Build 372 Canonical Unique Items grouped by Base Item Type and sorted by Tier (Normal -> Exceptional -> Elite)
  const uniqueByCanonicalKey = new Map<string, StaticUniqueItemBlueprint>()
  for (const u of tables.uniques.all) {
    if (!u.enabled) continue
    const code = u.code.trim()
    const lowerCode = code.toLowerCase()
    const base = tables.getBase(code) ?? tables.getBase(lowerCode)
    if (!base || !base.spawnable || (base as { quest?: number }).quest! > 0) {
      continue
    }
    const cleanIndex = u.index.trim()
    const dedupKey = `${lowerCode}:${cleanIndex.toLowerCase()}`
    const existing = uniqueByCanonicalKey.get(dedupKey)
    if (existing) {
      uniqueByCanonicalKey.set(dedupKey, {
        ...existing,
        ids: [...existing.ids, u.id],
      })
      continue
    }

    const rawBaseType = ((base as { type?: string }).type ?? base.kind).trim().toLowerCase()
    // Merge h2h2 (Assassin Claws with staffmods) into h2h (Assassin Katars) so all 4 Unique Claws are unified
    const baseType = rawBaseType === 'h2h2' ? 'h2h' : rawBaseType

    const b = base as { normcode?: string; ubercode?: string; ultracode?: string }
    let tier: DropEquipmentTier = 'normal'
    let tierRank: 0 | 1 | 2 = 0
    let tierLabelZh: '普通' | '扩展' | '精英' = '普通'
    let tierLabelEn: 'Normal' | 'Exceptional' | 'Elite' = 'Normal'
    if (b.ultracode && b.ultracode.trim().toLowerCase() === lowerCode) {
      tier = 'elite'
      tierRank = 2
      tierLabelZh = '精英'
      tierLabelEn = 'Elite'
    } else if (b.ubercode && b.ubercode.trim().toLowerCase() === lowerCode) {
      tier = 'exceptional'
      tierRank = 1
      tierLabelZh = '扩展'
      tierLabelEn = 'Exceptional'
    }

    const nameEn = lookupTblEn(cleanIndex) ?? cleanIndex
    const nameZh = lookupTblZh(cleanIndex) ?? nameEn
    const baseNameEn = lookupTblEn(code) ?? lookupTblEn(lowerCode) ?? base.name ?? code
    const baseNameZh = lookupTblZh(code) ?? lookupTblZh(lowerCode) ?? baseNameEn

    const fakeItem = {
      id: u.id,
      code,
      name: cleanIndex,
      quality: ItemQuality.UNIQUE,
      identified: true,
      base,
      uniqueItemDef: u,
      invWidth: base.invWidth ?? 1,
      invHeight: base.invHeight ?? 1,
    } as unknown as Item
    const invMeta = resolveItemInvFile(fakeItem, 'unique', code, tables)
    const spriteRect = resolveDropSpriteRect({
      code,
      name: cleanIndex,
      invFile: invMeta.invFile,
      invtransform: invMeta.invtransform,
    })

    uniqueByCanonicalKey.set(dedupKey, {
      id: u.id,
      ids: [u.id],
      index: cleanIndex,
      code,
      name: nameEn,
      nameZh,
      baseName: baseNameEn,
      baseNameZh,
      baseType,
      tier,
      tierRank,
      tierLabelZh,
      tierLabelEn,
      baseOrder: baseOrderMap.get(lowerCode) ?? 9999,
      lvl: u.lvl,
      lvlReq: u.levelreq,
      invWidth: base.invWidth ?? 1,
      invHeight: base.invHeight ?? 1,
      invFile: invMeta.invFile,
      invtransform: invMeta.invtransform,
      spriteRect,
    })
  }

  const uniquesByType = new Map<string, StaticUniqueItemBlueprint[]>()
  for (const item of uniqueByCanonicalKey.values()) {
    const list = uniquesByType.get(item.baseType) ?? []
    list.push(item)
    uniquesByType.set(item.baseType, list)
  }

  const uniqueGroups: StaticUniqueTypeGroupBlueprint[] = []
  const handledTypes = new Set<string>()

  const buildSortedGroup = (
    baseType: string,
    typeNameZh: string,
    typeNameEn: string,
    hasEquipmentTiers: boolean,
    rawItems: StaticUniqueItemBlueprint[],
  ): StaticUniqueTypeGroupBlueprint => {
    const sorted = [...rawItems].sort((a, b) => {
      if (a.tierRank !== b.tierRank) return a.tierRank - b.tierRank
      if (a.baseOrder !== b.baseOrder) return a.baseOrder - b.baseOrder
      if (a.lvl !== b.lvl) return a.lvl - b.lvl
      return a.id - b.id
    })
    return {
      baseType,
      typeNameZh,
      typeNameEn,
      hasEquipmentTiers,
      items: sorted,
    }
  }

  for (const meta of UNIQUE_BASE_TYPE_METADATA) {
    const items = uniquesByType.get(meta.baseType)
    if (!items || items.length === 0) continue
    handledTypes.add(meta.baseType)
    uniqueGroups.push(
      buildSortedGroup(
        meta.baseType,
        meta.typeNameZh,
        meta.typeNameEn,
        meta.hasEquipmentTiers,
        items,
      ),
    )
  }
  for (const [baseType, items] of uniquesByType.entries()) {
    if (handledTypes.has(baseType) || items.length === 0) continue
    uniqueGroups.push(buildSortedGroup(baseType, baseType, baseType, true, items))
  }

  // 3. Build 33 Runes (r01..r33) sorted in ascending numerical order
  const runes: StaticRuneBlueprint[] = []
  for (let i = 1; i <= 33; i++) {
    const code = `r${String(i).padStart(2, '0')}`
    const nameEn = lookupTblEn(code) ?? `Rune #${i}`
    const nameZh = lookupTblZh(code) ?? nameEn
    const invFile = BAKED_UI_MANIFEST.codeToInvFile[code] ?? `inv${code}`
    const spriteRect = resolveDropSpriteRect({ code, invFile })
    runes.push({
      runeNumber: i,
      code,
      name: nameEn,
      nameZh,
      invFile,
      spriteRect,
    })
  }

  cachedGrailBlueprint = {
    sets,
    uniqueGroups,
    runes,
  }
  return cachedGrailBlueprint
}

/**
 * Builds the Holy Grail Light-Up Mode (`点亮模式`) catalog from recorded ground drops:
 * - Sets (`套装`): 32 sets (127 pieces) organized by Set, lighting up dropped pieces.
 * - Uniques (`暗金装备`): 372 canonical unique items grouped by Base Item Type and sorted by Tier (`普通 -> 扩展 -> 精英`).
 * - Runes (`符文`): 33 runes (`r01`..`r33`) sorted in ascending numerical order (`#01`..`#33`).
 */
export function buildDropGrailCatalog(records: readonly DropRecord[]): DropGrailCatalog {
  const blueprint = getStaticGrailBlueprint()

  // Aggregate Set piece drop stats
  const setStatsById = new Map<number, { count: number; lastTimestamp: number; lastAreaNameZh: string }>()
  const setPiecesByName = new Map<string, number>()
  const setPiecesByCode = new Map<string, number[]>()
  const setPieceCodeById = new Map<number, string>()

  for (const sg of blueprint.sets) {
    for (const p of sg.pieces) {
      const lowerCode = p.code.toLowerCase()
      setPieceCodeById.set(p.id, lowerCode)
      setPiecesByName.set(p.index.toLowerCase(), p.id)
      setPiecesByName.set(p.name.toLowerCase(), p.id)
      setPiecesByName.set(p.nameZh.toLowerCase(), p.id)
      const list = setPiecesByCode.get(lowerCode) ?? []
      list.push(p.id)
      setPiecesByCode.set(lowerCode, list)
    }
  }

  // Aggregate Unique item drop stats
  const uniqueStatsByPrimaryId = new Map<
    number,
    { count: number; lastTimestamp: number; lastAreaNameZh: string }
  >()
  const uniquePrimaryIdByRawId = new Map<number, number>()
  const uniquePrimaryIdByName = new Map<string, number>()
  const uniquePrimaryIdsByCode = new Map<string, number[]>()
  const uniqueCodeByPrimaryId = new Map<number, string>()

  for (const ug of blueprint.uniqueGroups) {
    for (const u of ug.items) {
      const lowerCode = u.code.toLowerCase()
      uniqueCodeByPrimaryId.set(u.id, lowerCode)
      for (const rawId of u.ids) {
        uniquePrimaryIdByRawId.set(rawId, u.id)
      }
      uniquePrimaryIdByName.set(u.index.toLowerCase(), u.id)
      uniquePrimaryIdByName.set(u.name.toLowerCase(), u.id)
      uniquePrimaryIdByName.set(u.nameZh.toLowerCase(), u.id)
      const list = uniquePrimaryIdsByCode.get(lowerCode) ?? []
      list.push(u.id)
      uniquePrimaryIdsByCode.set(lowerCode, list)
    }
  }

  // Aggregate Rune drop stats
  const runeStatsByCode = new Map<
    string,
    { count: number; lastTimestamp: number; lastAreaNameZh: string }
  >()

  const bumpStat = <K>(
    map: Map<K, { count: number; lastTimestamp: number; lastAreaNameZh: string }>,
    key: K,
    rec: DropRecord,
  ): void => {
    const prev = map.get(key)
    if (!prev) {
      map.set(key, {
        count: 1,
        lastTimestamp: rec.timestamp,
        lastAreaNameZh: rec.areaNameZh,
      })
    } else {
      const isNewer = rec.timestamp >= prev.lastTimestamp
      map.set(key, {
        count: prev.count + 1,
        lastTimestamp: isNewer ? rec.timestamp : prev.lastTimestamp,
        lastAreaNameZh: isNewer ? rec.areaNameZh : prev.lastAreaNameZh,
      })
    }
  }

  for (const rec of records) {
    const lowerCode = rec.code.trim().toLowerCase()
    const lowerName = rec.name.trim().toLowerCase()
    const lowerNameZh = rec.nameZh.trim().toLowerCase()

    if (rec.category === 'rune') {
      bumpStat(runeStatsByCode, lowerCode, rec)
      continue
    }

    if (rec.category === 'set') {
      let matchedId: number | undefined
      if (typeof rec.setItemId === 'number') {
        const expectedCode = setPieceCodeById.get(rec.setItemId)
        if (expectedCode && (!lowerCode || expectedCode === lowerCode)) {
          matchedId = rec.setItemId
        }
      }
      if (matchedId === undefined) {
        matchedId = setPiecesByName.get(lowerName) ?? setPiecesByName.get(lowerNameZh)
      }
      if (matchedId === undefined) {
        const candidates = setPiecesByCode.get(lowerCode)
        if (candidates && candidates.length > 0) {
          matchedId = candidates[0]
        }
      }
      if (matchedId !== undefined) {
        bumpStat(setStatsById, matchedId, rec)
      }
      continue
    }

    if (rec.category === 'unique') {
      let primaryId: number | undefined
      if (typeof rec.uniqueItemId === 'number') {
        const candId = uniquePrimaryIdByRawId.get(rec.uniqueItemId)
        if (candId !== undefined) {
          const expectedCode = uniqueCodeByPrimaryId.get(candId)
          if (expectedCode && (!lowerCode || expectedCode === lowerCode)) {
            primaryId = candId
          }
        }
      }
      if (primaryId === undefined) {
        primaryId =
          uniquePrimaryIdByName.get(lowerName) ?? uniquePrimaryIdByName.get(lowerNameZh)
      }
      if (primaryId === undefined) {
        const candidates = uniquePrimaryIdsByCode.get(lowerCode)
        if (candidates && candidates.length > 0) {
          primaryId = candidates[0]
        }
      }
      if (primaryId !== undefined) {
        bumpStat(uniqueStatsByPrimaryId, primaryId, rec)
      }
    }
  }

  let litSetPieces = 0
  let totalSetPieces = 0
  let completedSets = 0

  const sets: DropGrailSetGroup[] = blueprint.sets.map((sg) => {
    let groupLit = 0
    let groupDrops = 0
    const pieces: DropGrailSetPieceEntry[] = sg.pieces.map((p) => {
      const stat = setStatsById.get(p.id)
      const count = stat?.count ?? 0
      const lit = count > 0
      totalSetPieces += 1
      if (lit) {
        litSetPieces += 1
        groupLit += 1
      }
      groupDrops += count
      return {
        ...p,
        count,
        lit,
        lastTimestamp: stat?.lastTimestamp ?? 0,
        lastAreaNameZh: stat?.lastAreaNameZh ?? '',
      }
    })
    const completed = pieces.length > 0 && groupLit === pieces.length
    if (completed) completedSets += 1
    return {
      id: sg.id,
      index: sg.index,
      name: sg.name,
      nameZh: sg.nameZh,
      pieces,
      litPieces: groupLit,
      totalPieces: pieces.length,
      totalDrops: groupDrops,
      completed,
    }
  })

  let litUniqueItems = 0
  let totalUniqueItems = 0

  const uniqueGroups: DropGrailUniqueTypeGroup[] = blueprint.uniqueGroups.map((ug) => {
    let groupLit = 0
    let groupDrops = 0
    const items: DropGrailUniqueItemEntry[] = ug.items.map((u) => {
      const stat = uniqueStatsByPrimaryId.get(u.id)
      const count = stat?.count ?? 0
      const lit = count > 0
      totalUniqueItems += 1
      if (lit) {
        litUniqueItems += 1
        groupLit += 1
      }
      groupDrops += count
      return {
        id: u.id,
        ids: u.ids,
        index: u.index,
        code: u.code,
        name: u.name,
        nameZh: u.nameZh,
        baseName: u.baseName,
        baseNameZh: u.baseNameZh,
        baseType: u.baseType,
        tier: u.tier,
        tierRank: u.tierRank,
        tierLabelZh: u.tierLabelZh,
        tierLabelEn: u.tierLabelEn,
        lvl: u.lvl,
        lvlReq: u.lvlReq,
        invWidth: u.invWidth,
        invHeight: u.invHeight,
        invFile: u.invFile,
        invtransform: u.invtransform,
        spriteRect: u.spriteRect,
        count,
        lit,
        lastTimestamp: stat?.lastTimestamp ?? 0,
        lastAreaNameZh: stat?.lastAreaNameZh ?? '',
      }
    })
    return {
      baseType: ug.baseType,
      typeNameZh: ug.typeNameZh,
      typeNameEn: ug.typeNameEn,
      hasEquipmentTiers: ug.hasEquipmentTiers,
      items,
      litItems: groupLit,
      totalItems: items.length,
      totalDrops: groupDrops,
    }
  })

  let litRunes = 0
  const runes: DropGrailRuneEntry[] = blueprint.runes.map((r) => {
    const stat = runeStatsByCode.get(r.code)
    const count = stat?.count ?? 0
    const lit = count > 0
    if (lit) litRunes += 1
    return {
      ...r,
      count,
      lit,
      lastTimestamp: stat?.lastTimestamp ?? 0,
      lastAreaNameZh: stat?.lastAreaNameZh ?? '',
    }
  })

  return {
    sets,
    uniqueGroups,
    runes,
    litSetPieces,
    totalSetPieces,
    completedSets,
    totalSets: sets.length,
    litUniqueItems,
    totalUniqueItems,
    litRunes,
    totalRunes: runes.length,
  }
}


/**
 * In-memory implementation of `DropStatsRepository` for deterministic unit testing.
 */
export class MemoryDropStatsRepository implements DropStatsRepository {
  private records: DropRecord[] = []
  private nextId = 1

  constructor(initialRecords: readonly DropRecord[] = []) {
    this.records = initialRecords.map((r, idx) => ({
      ...r,
      id: r.id ?? idx + 1,
    }))
    this.nextId = this.records.length + 1
  }

  async loadAll(): Promise<readonly DropRecord[]> {
    return [...this.records]
  }

  async append(record: DropRecord): Promise<DropRecord> {
    const saved: DropRecord = {
      ...record,
      id: record.id ?? this.nextId++,
    }
    this.records.push(saved)
    return saved
  }

  async clear(): Promise<void> {
    this.records = []
    this.nextId = 1
  }

  getSnapshotSync(): DropStatsSummary {
    return summarizeDropRecords(this.records)
  }
}

export interface IndexedDbDropStatsRepositoryOptions {
  readonly dbName?: string | undefined
  readonly storageKey?: string | undefined
  readonly storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null | undefined
  readonly hydrateSync?: boolean | undefined
}

/**
 * Browser-persistent `DropStatsRepository` backed by IndexedDB (`d2-drop-tracker-db`)
 * with synchronous `localStorage` mirror (`d2-drop-tracker-snapshot-v1`).
 */
export class IndexedDbDropStatsRepository implements DropStatsRepository {
  private readonly dbName: string
  private readonly storageKey: string
  private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
  private readonly hydrateSync: boolean
  private cachedRecords: DropRecord[] = []
  private nextFallbackId = 1
  private dbPromise: Promise<IDBDatabase | null> | null = null

  constructor(options: IndexedDbDropStatsRepositoryOptions = {}) {
    this.dbName = options.dbName ?? DROP_TRACKER_DB_NAME
    this.storageKey = options.storageKey ?? DROP_TRACKER_STORAGE_KEY
    this.storage =
      options.storage !== undefined
        ? options.storage
        : typeof localStorage !== 'undefined'
          ? localStorage
          : null
    this.hydrateSync = options.hydrateSync ?? options.storage !== undefined
    if (this.hydrateSync) {
      this.cachedRecords = this.readMirrorFromStorage()
      for (const r of this.cachedRecords) {
        if (typeof r.id === 'number' && r.id >= this.nextFallbackId) {
          this.nextFallbackId = r.id + 1
        }
      }
    }
  }

  getSnapshotSync(): DropStatsSummary {
    if (this.hydrateSync) {
      const fromMirror = this.readMirrorFromStorage()
      if (fromMirror.length > 0 || this.cachedRecords.length === 0) {
        this.cachedRecords = fromMirror
      }
    }
    return summarizeDropRecords(this.cachedRecords)
  }

  async loadAll(): Promise<readonly DropRecord[]> {
    const db = await this.openDb()
    if (!db) {
      this.cachedRecords = this.readMirrorFromStorage()
      return [...this.cachedRecords]
    }
    try {
      const rows = await new Promise<DropRecord[]>((resolve, reject) => {
        const tx = db.transaction(DROP_TRACKER_STORE_NAME, 'readonly')
        const store = tx.objectStore(DROP_TRACKER_STORE_NAME)
        const req = store.getAll()
        req.onsuccess = () => {
          const raw = Array.isArray(req.result) ? (req.result as DropRecord[]) : []
          resolve(raw)
        }
        req.onerror = () => reject(req.error ?? new Error('IndexedDB getAll failed'))
      })
      if (rows.length === 0 && this.cachedRecords.length > 0) {
        return [...this.cachedRecords]
      }
      this.cachedRecords = rows
      this.writeMirrorToStorage(this.cachedRecords)
      return [...this.cachedRecords]
    } catch {
      return [...this.cachedRecords]
    }
  }

  async append(record: DropRecord): Promise<DropRecord> {
    const db = await this.openDb()
    let saved: DropRecord = {
      ...record,
      id: record.id ?? this.nextFallbackId++,
    }
    if (db) {
      try {
        const assignedId = await new Promise<number>((resolve, reject) => {
          const tx = db.transaction(DROP_TRACKER_STORE_NAME, 'readwrite')
          const store = tx.objectStore(DROP_TRACKER_STORE_NAME)
          const payload: Record<string, unknown> = { ...record }
          if (payload.id === undefined) {
            delete payload.id
          }
          const req = store.add(payload)
          req.onsuccess = () => resolve(Number(req.result))
          req.onerror = () => reject(req.error ?? new Error('IndexedDB add failed'))
        })
        if (Number.isFinite(assignedId)) {
          saved = { ...record, id: assignedId }
          if (assignedId >= this.nextFallbackId) {
            this.nextFallbackId = assignedId + 1
          }
        }
      } catch {
        // Fallback to mirror storage when IndexedDB write fails
      }
    }
    this.cachedRecords.push(saved)
    this.writeMirrorToStorage(this.cachedRecords)
    return saved
  }

  async clear(): Promise<void> {
    this.cachedRecords = []
    this.nextFallbackId = 1
    this.writeMirrorToStorage([])
    const db = await this.openDb()
    if (!db) return
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(DROP_TRACKER_STORE_NAME, 'readwrite')
        const store = tx.objectStore(DROP_TRACKER_STORE_NAME)
        const req = store.clear()
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error ?? new Error('IndexedDB clear failed'))
      })
    } catch {
      // Ignore IndexedDB clear failure if mirror already cleared
    }
  }

  private openDb(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise
    if (typeof indexedDB === 'undefined' || !indexedDB || typeof indexedDB.open !== 'function') {
      this.dbPromise = Promise.resolve(null)
      return this.dbPromise
    }
    this.dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      try {
        const req = indexedDB.open(this.dbName, DROP_TRACKER_DB_VERSION)
        req.onupgradeneeded = () => {
          const db = req.result
          if (!db.objectStoreNames.contains(DROP_TRACKER_STORE_NAME)) {
            const store = db.createObjectStore(DROP_TRACKER_STORE_NAME, {
              keyPath: 'id',
              autoIncrement: true,
            })
            store.createIndex('by_category', 'category', { unique: false })
            store.createIndex('by_timestamp', 'timestamp', { unique: false })
            store.createIndex('by_code', 'code', { unique: false })
          }
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
    return this.dbPromise
  }

  private readMirrorFromStorage(): DropRecord[] {
    if (!this.storage) return []
    try {
      const raw = this.storage.getItem(this.storageKey)
      if (!raw) return []
      const parsed = JSON.parse(raw) as { records?: unknown }
      if (!parsed || !Array.isArray(parsed.records)) return []
      const valid: DropRecord[] = []
      for (const item of parsed.records) {
        if (!item || typeof item !== 'object') continue
        const r = item as Partial<DropRecord>
        if (
          typeof r.code === 'string' &&
          (r.category === 'set' || r.category === 'unique' || r.category === 'rune') &&
          typeof r.timestamp === 'number' &&
          typeof r.itemId === 'number'
        ) {
          valid.push({
            id: typeof r.id === 'number' ? r.id : undefined,
            timestamp: r.timestamp,
            itemId: r.itemId,
            code: r.code,
            name: typeof r.name === 'string' ? r.name : r.code,
            nameZh: typeof r.nameZh === 'string' ? r.nameZh : r.code,
            category: r.category,
            areaId: typeof r.areaId === 'number' ? r.areaId : 0,
            areaNameZh:
              typeof r.areaNameZh === 'string'
                ? r.areaNameZh
                : resolveDropAreaNameZh(typeof r.areaId === 'number' ? r.areaId : 0),
            areaNameEn:
              typeof r.areaNameEn === 'string'
                ? r.areaNameEn
                : resolveDropAreaNameEn(typeof r.areaId === 'number' ? r.areaId : 0),
            quality: typeof r.quality === 'number' ? r.quality : undefined,
            setItemId: typeof r.setItemId === 'number' ? r.setItemId : undefined,
            uniqueItemId: typeof r.uniqueItemId === 'number' ? r.uniqueItemId : undefined,
          })
        }
      }
      return valid
    } catch {
      return []
    }
  }

  private writeMirrorToStorage(records: readonly DropRecord[]): void {
    if (!this.storage) return
    try {
      const summary = summarizeDropRecords(records)
      this.storage.setItem(
        this.storageKey,
        JSON.stringify({
          version: 1,
          setCount: summary.setCount,
          uniqueCount: summary.uniqueCount,
          runeCount: summary.runeCount,
          totalTracked: summary.totalTracked,
          records: summary.records,
        }),
      )
    } catch {
      // Ignore quota errors in mirror storage
    }
  }
}

export interface DropTrackerEventSource {
  on?(eventName: string, handler: (payload: unknown) => void): (() => void) | void
  off?(eventName: string, handler: (payload: unknown) => void): void
}

export interface DropTrackerOptions {
  readonly session?: PluginSessionView | undefined
  readonly events?: DropTrackerEventSource | undefined
  readonly repository?: DropStatsRepository | undefined
  readonly log?: PluginLogger | undefined
  readonly now?: (() => number) | undefined
  readonly onSummaryChange?: ((summary: DropStatsSummary) => void) | undefined
}

export type DropBroadcastMessage =
  | {
      readonly type: 'drop-recorded'
      readonly record: DropRecord
      readonly summary: DropStatsSummary
    }
  | {
      readonly type: 'drops-cleared'
      readonly summary: DropStatsSummary
    }

/**
 * Coordinates ground-drop event filtering, session `item.id` deduplication,
 * persistence via `DropStatsRepository`, and live `BroadcastChannel` notifications.
 */
export class DropTracker {
  readonly repository: DropStatsRepository
  private readonly session: PluginSessionView | undefined
  private readonly events: DropTrackerEventSource | undefined
  private readonly log: PluginLogger | undefined
  private readonly now: () => number
  private readonly onSummaryChange: ((summary: DropStatsSummary) => void) | undefined
  private readonly seenItemIds = new Set<number>()
  private readonly listeners = new Set<(summary: DropStatsSummary) => void>()
  private unsubServerEvent: (() => void) | null = null
  private unsubStateChange: (() => void) | null = null
  private unsubCustomEvent: (() => void) | null = null
  private channel: BroadcastChannel | null = null
  private records: DropRecord[] = []
  private currentAreaId = 0
  private lastPhase: string | null = null
  private pendingWrites: Promise<unknown>[] = []
  private destroyed = false

  constructor(options: DropTrackerOptions = {}) {
    this.repository = options.repository ?? new IndexedDbDropStatsRepository()
    this.session = options.session
    this.events = options.events
    this.log = options.log
    this.now = options.now ?? (() => Date.now())
    this.onSummaryChange = options.onSummaryChange

    const initialSnap = this.repository.getSnapshotSync()
    this.records = [...initialSnap.records]

    if (this.session) {
      this.lastPhase = this.session.phase
      const worldObj = this.session.world as
        | { areaId?: number; currentLevel?: number }
        | undefined
      const worldLevel = worldObj?.areaId || worldObj?.currentLevel || 0
      if (typeof worldLevel === 'number' && worldLevel > 0) {
        this.currentAreaId = worldLevel
      }
      this.unsubServerEvent = this.session.onServerEvent((ev) => {
        this.handleServerEvent(ev)
      })
      this.unsubStateChange = this.session.onStateChange((snap) => {
        const nextPhase = snap?.phase ?? this.session?.phase ?? null
        if (nextPhase !== this.lastPhase) {
          if (nextPhase !== 'ingame') {
            this.resetSessionSeen()
          }
          this.lastPhase = nextPhase
        }
      })
    }

    if (this.events && typeof this.events.on === 'function') {
      const handler = (payload: unknown): void => {
        void this.handleEventPayload(payload)
      }
      const unsubs: Array<() => void> = []
      for (const eventName of ['ItemAction', 'ItemEvent', 'item:dropped']) {
        const maybeUnsub = this.events.on(eventName, handler)
        if (typeof maybeUnsub === 'function') {
          unsubs.push(maybeUnsub)
        } else if (typeof this.events.off === 'function') {
          const eventsRef = this.events
          unsubs.push(() => {
            eventsRef.off?.(eventName, handler)
          })
        }
      }
      if (unsubs.length > 0) {
        this.unsubCustomEvent = () => {
          for (const u of unsubs) u()
        }
      }
    }

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(DROP_TRACKER_CHANNEL_NAME)
        this.channel.onmessage = (ev: MessageEvent<DropBroadcastMessage>) => {
          if (this.destroyed || !ev.data || typeof ev.data !== 'object') return
          if (ev.data.type === 'drop-recorded' || ev.data.type === 'drops-cleared') {
            this.records = [...ev.data.summary.records]
            this.emitSummaryChange()
          }
        }
      } catch {
        this.channel = null
      }
    }
  }

  async init(): Promise<DropStatsSummary> {
    const loaded = await this.repository.loadAll()
    if (!this.destroyed) {
      if (this.records.length === 0) {
        this.records = [...loaded]
      } else if (loaded.length > 0) {
        const merged = [...loaded]
        for (const r of this.records) {
          const alreadyInLoaded = loaded.some(
            (l) =>
              (r.id !== undefined && l.id === r.id) ||
              (l.itemId === r.itemId && l.timestamp === r.timestamp && l.code === r.code),
          )
          if (!alreadyInLoaded) {
            merged.push(r)
          }
        }
        this.records = merged
      }
      this.emitSummaryChange()
    }
    return this.getSummary()
  }

  /**
   * Resets the per-game-session `seenItemIds` set so a new game session starts clean.
   */
  resetSessionSeen(): void {
    this.seenItemIds.clear()
  }

  hasSeenItemId(itemId: number): boolean {
    return this.seenItemIds.has(itemId)
  }

  getSeenItemCount(): number {
    return this.seenItemIds.size
  }

  getSummary(): DropStatsSummary {
    return summarizeDropRecords(this.records)
  }

  subscribe(listener: (summary: DropStatsSummary) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  handleServerEvent(ev: ServerEvent): DropRecord | null {
    if (this.destroyed) return null
    if (
      ev.type === 'GameLoading' ||
      ev.type === 'GameFlags' ||
      ev.type === 'GameLogout' ||
      ev.type === 'UnloadComplete'
    ) {
      this.resetSessionSeen()
      return null
    }
    if (ev.type === 'LoadAct') {
      if (typeof ev.areaId === 'number' && ev.areaId > 0) {
        this.currentAreaId = ev.areaId
      }
      return null
    }
    if (ev.type === 'RoomReveal') {
      if (this.currentAreaId <= 0 && typeof ev.areaId === 'number' && ev.areaId > 0) {
        this.currentAreaId = ev.areaId
      }
      return null
    }
    if (ev.type === 'ItemEvent') {
      return this.recordCandidateEvent({
        type: 'ItemEvent',
        action: ev.action,
        container: ev.container,
        item: ev.item,
      })
    }
    return this.handleEventPayload(ev)
  }

  handleEventPayload(payload: unknown): DropRecord | null {
    if (this.destroyed || !payload || typeof payload !== 'object') return null
    const candidate = payload as DropCandidateEvent
    if (candidate.type === 'GameFlags' || candidate.type === 'GameLoading' || candidate.type === 'GameLogout') {
      this.resetSessionSeen()
      return null
    }
    // Support both `{ type: 'ItemEvent' | 'ItemAction', item: ... }` and bare `{ action, container, item }` or `{ id, code, quality, container, action }`
    if (candidate.item && typeof candidate.item === 'object') {
      return this.recordCandidateEvent(candidate)
    }
    const bareItem = payload as DropCandidateItem & {
      readonly destination?: string | undefined
      readonly areaId?: number | undefined
      readonly timestamp?: number | undefined
    }
    if (typeof bareItem.code === 'string' || typeof bareItem.rawCode === 'string') {
      return this.recordCandidateEvent({
        type: 'ItemAction',
        action: bareItem.action ?? 0x00,
        container: bareItem.container ?? bareItem.destination ?? 'ground',
        areaId: bareItem.areaId,
        timestamp: bareItem.timestamp,
        item: bareItem,
      })
    }
    return null
  }

  recordCandidateEvent(ev: DropCandidateEvent): DropRecord | null {
    if (this.destroyed) return null
    if (!isGroundDropEvent(ev)) return null
    const item = ev.item
    if (!item) return null

    const category = classifyDropItem(item)
    if (!category) return null

    const rawId =
      typeof item.id === 'number' && Number.isFinite(item.id)
        ? item.id
        : typeof item.itemId === 'number' && Number.isFinite(item.itemId)
          ? item.itemId
          : null

    if (rawId !== null) {
      if (this.seenItemIds.has(rawId)) {
        return null
      }
      this.seenItemIds.add(rawId)
    }

    const worldObj = this.session?.world as
      | { areaId?: number; currentLevel?: number }
      | undefined
    const worldLevel = worldObj?.areaId || worldObj?.currentLevel || 0
    const areaId =
      typeof ev.areaId === 'number' && ev.areaId > 0
        ? Math.trunc(ev.areaId)
        : typeof worldLevel === 'number' && worldLevel > 0
          ? Math.trunc(worldLevel)
          : this.currentAreaId > 0
            ? this.currentAreaId
            : 0

    const resolvedNames = resolveDropItemNames(item)
    const record: DropRecord = {
      timestamp: typeof ev.timestamp === 'number' ? ev.timestamp : this.now(),
      itemId: rawId ?? 0,
      code: resolvedNames.code,
      name: resolvedNames.name,
      nameZh: resolvedNames.nameZh,
      category,
      areaId,
      areaNameZh: resolveDropAreaNameZh(areaId),
      areaNameEn: resolveDropAreaNameEn(areaId),
      quality: typeof item.quality === 'number' ? item.quality : undefined,
      setItemId: typeof item.setItemId === 'number' ? item.setItemId : undefined,
      uniqueItemId: typeof item.uniqueItemId === 'number' ? item.uniqueItemId : undefined,
    }

    this.records.push(record)
    const summary = this.getSummary()
    this.emitSummaryChange()
    this.broadcast({
      type: 'drop-recorded',
      record,
      summary,
    })

    const writePromise = this.repository.append(record).catch((err) => {
      this.log?.warn('Failed to persist drop record', err)
    })
    this.pendingWrites.push(writePromise)
    return record
  }

  async flushNow(): Promise<void> {
    if (this.pendingWrites.length === 0) return
    const pending = [...this.pendingWrites]
    this.pendingWrites = []
    await Promise.all(pending)
  }

  async clearAll(): Promise<DropStatsSummary> {
    await this.flushNow()
    this.records = []
    this.resetSessionSeen()
    await this.repository.clear()
    const summary = this.getSummary()
    this.emitSummaryChange()
    this.broadcast({
      type: 'drops-cleared',
      summary,
    })
    return summary
  }

  exportJson(): string {
    const summary = this.getSummary()
    return JSON.stringify(
      {
        version: 1,
        exportedAt: this.now(),
        setCount: summary.setCount,
        uniqueCount: summary.uniqueCount,
        runeCount: summary.runeCount,
        totalTracked: summary.totalTracked,
        records: summary.records,
      },
      null,
      2,
    )
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.unsubServerEvent?.()
    this.unsubServerEvent = null
    this.unsubStateChange?.()
    this.unsubStateChange = null
    this.unsubCustomEvent?.()
    this.unsubCustomEvent = null
    if (this.channel) {
      try {
        this.channel.close()
      } catch {
        // Ignore close errors
      }
      this.channel = null
    }
    this.listeners.clear()
  }

  private emitSummaryChange(): void {
    const summary = this.getSummary()
    this.onSummaryChange?.(summary)
    for (const listener of [...this.listeners]) {
      listener(summary)
    }
  }

  private broadcast(msg: DropBroadcastMessage): void {
    if (!this.channel) return
    try {
      this.channel.postMessage(msg)
    } catch {
      // Ignore postMessage failure in restricted environments
    }
  }
}
