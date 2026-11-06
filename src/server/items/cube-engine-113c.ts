/**
 * Server-side Diablo II v1.13c Socketing, Runeword & Horadric Cube Engine (`#1829`, `#1830`).
 *
 * Ground-truth references:
 * - `D2Game.dll` `0x6FCF4A70..0x6FCF4D01` (`D2GAME_SocketItem`, `C2S 0x28`)
 * - `D2Common.dll` `0x6FD76BA0..0x6FD76D39` (`ITEMS_CheckRuneword`, 78 `complete=1` rows in `Runes.txt`)
 * - `D2Common.dll` `ITEMS_GetGemApplyType` (`Gems.txt` 35 gems + 33 runes: `0=weapon`, `1=helm/torso`, `2=shield`)
 * - `D2Game.dll` `0x6FC90AE0..0x6FC9351D` (`CUBEMAIN_Transmute`, 146 `enabled=1` rows in `Cubemain.txt`)
 */

import {
  NON_RANDOM_RANGE_CODES,
  calculateAlvl,
  getBaseMagicLvl,
  getBaseQlvl,
  getItemTypeCode,
  rollMagicAffixes,
  rollRareAffixes,
  type GeneratedAffixes,
  type GeneratedRareAffixes,
  type RolledAffix,
  type RolledMod,
} from '../../common/items/affix-generator.ts'
import { isAffixEligible, type MagicAffix } from '../../common/items/affixes.ts'
import type { DropTables } from '../../common/items/drop-tables.ts'
import { getEmbeddedDropTables } from '../../common/items/embedded-drop-tables.ts'
import { GEM_INFO, RUNE_INFO, isRuneCode } from '../../common/items/gems-data.ts'
import { CANONICAL_GEMS_TABLE, getMaxSockets } from '../../common/items/gems.ts'
import { rolledPropsToItemStats } from '../../common/items/item-bridge.ts'
import { ItemQuality, type Item, type ItemBase, type RolledItemProp } from '../../common/items/items.ts'
import { isRareNameEligible, type RareNameEntry } from '../../common/items/rare-names.ts'
import {
  isSocketableFiller,
  resolveGemApplyType,
} from '../../common/items/runeword-socket.ts'
import {
  CANONICAL_RUNES_TABLE,
  checkRunewordMatch,
  isQuestItemBase113c,
  type RunewordMatchResult,
} from '../../common/items/runeword.ts'
import type { D2Rng } from '../../common/rng/d2-rng.ts'
import {
  ITEM_FLAG_COMPACT,
  ITEM_FLAG_ETHEREAL,
  ITEM_FLAG_IDENTIFIED,
  ITEM_FLAG_INSOCKET,
  ITEM_FLAG_RUNEWORD,
  ITEM_FLAG_SOCKETED,
  type ItemData,
  type ItemQuality as WireItemQuality,
  type ItemStat,
  type UnitId,
} from '../../netproto/index.ts'
import {
  ENABLED_CUBEMAIN_RECIPES_113C,
  type CubemainMod113c,
  type CubemainRecipeRow113c,
} from './cubemain-data-113c.ts'
import { domainItemToItemData113c, resolveGemSocketItemStats113c } from './server-item-data.ts'
export { resolveGemSocketItemStats113c }

const STAT_ARMOR_PERCENT = 16
const STAT_ARMORCLASS = 31
const STAT_QUANTITY = 70
const STAT_ITEM_LEVELREQ = 92
const STAT_ITEM_CHARGED_SKILL = 204
const STAT_QUEST_ITEM_DIFFICULTY = 356

function baseDurability113c(base: ItemBase): number {
  return Number((base as { readonly durability?: number }).durability ?? 0) || 0
}

function baseStackable113c(base: ItemBase): boolean {
  return (base as { readonly stackable?: boolean }).stackable === true
}

/**
 * Wire `ItemData.defense` (`STAT_ARMORCLASS = 31` on the base stat list) for a Cube-generated
 * armor: `maxac + 1` (unscaled) when the item rolled `ac%`, otherwise `[minac, maxac]`.
 * On-piece `ac%` (`stat 16`) and `+ac` (`stat 31`) are emitted in `ItemData.stats` so neither
 * client nor server double-multiplies `%ED` (#1911).
 */
function rollCubeArmorDefense113c(
  base: ItemBase,
  props: readonly RolledItemProp[],
  rng: D2Rng,
): number {
  let acPct = 0
  for (const p of props) {
    if (p.code.trim().toLowerCase() === 'ac%') acPct += Number(p.value ?? p.min ?? 0)
  }
  const minac = Number((base as { readonly minac?: number }).minac) || base.defense
  const maxac = Number((base as { readonly maxac?: number }).maxac) || base.defense
  if (acPct > 0) {
    return maxac + 1
  }
  return minac < maxac ? rng.randRange(minac, maxac) : maxac
}

const EXTRA_NON_RANDOM_PROP_CODES: ReadonlySet<string> = new Set([
  'dmg-throw',
])

function isCoupledRangePropCode(code: string): boolean {
  const lower = code.trim().toLowerCase()
  return NON_RANDOM_RANGE_CODES.has(lower) || EXTRA_NON_RANDOM_PROP_CODES.has(lower)
}

function rollPropList113c(
  defs: readonly {
    readonly code: string
    readonly param?: number | string | undefined
    readonly min: number
    readonly max: number
    readonly chance?: number | undefined
  }[],
  rng: D2Rng,
): RolledItemProp[] {
  const out: RolledItemProp[] = []
  for (const def of defs) {
    const code = def.code.trim()
    if (!code) continue
    // Properties.txt `ethereal` (`func1 = 23`, e.g. Famine T1Code7) has no ItemStatCost row
    // and does not turn an already-socketed item ethereal in 1.13c D2Common.
    if (code.toLowerCase() === 'ethereal') continue
    if (def.chance !== undefined && def.chance > 0 && def.chance < 100) {
      if (rng.rand(100) >= def.chance) continue
    }
    let val: number
    if (isCoupledRangePropCode(code) || def.min === def.max) {
      val = def.min
    } else {
      const lo = Math.min(def.min, def.max)
      const hi = Math.max(def.min, def.max)
      val = rng.randRange(lo, hi)
    }
    const rawParam =
      def.param !== undefined && String(def.param).trim() !== '' ? def.param : undefined
    out.push({
      code,
      ...(rawParam !== undefined ? { param: rawParam } : {}),
      min: def.min,
      max: def.max,
      value: val,
    })
  }
  return out
}

function propsToWireItemStats(
  props: readonly RolledItemProp[],
  baseCode: string,
): ItemStat[] {
  const filtered = props.filter((p) => p.code.trim().toLowerCase() !== 'ethereal')
  return rolledPropsToItemStats(filtered, { baseCode }).map((s) => ({
    statId: s.statId as number,
    param: s.param ?? 0,
    value: s.value,
  }))
}

function computeSingleItemReqLevel113c(
  item: ItemData,
  tables: DropTables,
): number {
  const code = item.code.trim().toLowerCase()
  const base = tables.getBase(code)
  let req = Number((base as { readonly levelreq?: number } | undefined)?.levelreq ?? 0)
  const runeReq = RUNE_INFO[code]?.reqLevel ?? 0
  const gemReq = GEM_INFO[code]?.reqLevel ?? 0
  if (runeReq > req) req = runeReq
  if (gemReq > req) req = gemReq

  let reqBonus = 0
  for (const st of item.stats ?? []) {
    if (st.statId === STAT_ITEM_LEVELREQ) {
      reqBonus += st.value
    }
  }
  if (item.quality === 7 && item.uniqueItemId !== undefined) {
    const u = tables.uniques.getById(item.uniqueItemId)
    if (u && u.levelreq > req) req = u.levelreq
  } else if (item.quality === 5 && item.setItemId !== undefined) {
    const s = tables.sets.items.getById(item.setItemId)
    if (s && s.levelreq > req) req = s.levelreq
  } else if (item.quality === 4) {
    if (item.magicPrefixId) {
      const p = tables.magicAffixes.prefixes.all.find((a) => a.id === item.magicPrefixId)
      if (p && p.levelreq > req) req = p.levelreq
    }
    if (item.magicSuffixId) {
      const s = tables.magicAffixes.suffixes.all.find((a) => a.id === item.magicSuffixId)
      if (s && s.levelreq > req) req = s.levelreq
    }
  } else if ((item.quality === 6 || item.quality === 8) && item.rareAffixes) {
    let affixCount = 0
    for (let i = 0; i < item.rareAffixes.length; i++) {
      const aid = item.rareAffixes[i]!
      if (aid <= 0) continue
      affixCount++
      const table = i % 2 === 0 ? tables.magicAffixes.prefixes : tables.magicAffixes.suffixes
      const a = table.all.find((x) => x.id === aid)
      if (a && a.levelreq > req) req = a.levelreq
    }
    if (item.quality === 8) {
      const craftReq = req + 10 + 3 * affixCount
      if (craftReq > req) req = craftReq
    }
  }
  for (const child of item.socketedItems ?? []) {
    const childReq = computeSingleItemReqLevel113c(child, tables)
    if (childReq > req) req = childReq
  }
  return Math.max(0, req + reqBonus)
}

export interface ExecuteSocketItemParams113c {
  readonly host: ItemData
  readonly filler: ItemData
  readonly rng: D2Rng
  readonly playerLevel: number
  readonly isHostEquipped: boolean
  readonly isLadder: boolean
  readonly tables?: DropTables | undefined
}

export type ExecuteSocketItemResult113c =
  | {
      readonly ok: true
      readonly hostItem: ItemData
      readonly socketChild: ItemData
      readonly socketIndex: number
      readonly runewordMatch?: RunewordMatchResult | undefined
      readonly combinedStatsMap: Map<number, number>
    }
  | {
      readonly ok: false
      readonly reason:
        | 'invalid_filler'
        | 'invalid_host'
        | 'unidentified'
        | 'no_free_sockets'
        | 'level_requirement'
    }

function buildDomainStubForRunewordCheck(
  host: ItemData,
  base: ItemBase,
  totalSockets: number,
): Item {
  const q = (host.quality ?? 2) as ItemQuality
  return {
    base,
    prefix: null,
    suffix: null,
    level: host.ilvl ?? 1,
    ilvl: host.ilvl ?? 1,
    name: base.name,
    stats: { sockets: totalSockets },
    invWidth: host.invWidth ?? base.invWidth,
    invHeight: host.invHeight ?? base.invHeight,
    stack: 1,
    value: base.value,
    code: host.code.trim(),
    quality: q,
    rarity: q === ItemQuality.SUPERIOR ? 'superior' : q === ItemQuality.LOW ? 'low' : 'normal',
    identified: true,
    totalSockets,
  }
}

/**
 * Executes 1.13c `D2GAME_SocketItem` (`C2S 0x28`, `0x6FCF4A70`):
 * - Validates socketable filler (`r01..r33`, `gcv..skz`, or `jew`) and socketed equipment host.
 * - Rejects equipped hosts if the resulting item `reqLevel` exceeds `playerLevel`.
 * - Appends the socket child (`location = 6`, `opcode = 0x9d`, `ownerType = 4`, `ownerId = host.id`).
 * - Evaluates all 78 `complete=1` 1.13c Runewords (`Runes.txt`) when the final socket is filled
 *   with Runes on a `quality <= 3` (`LOW` / `NORMAL` / `SUPERIOR`) base (`totalSockets === runes.length`).
 */
export function executeSocketItem113c(
  params: ExecuteSocketItemParams113c,
): ExecuteSocketItemResult113c {
  const tables = params.tables ?? getEmbeddedDropTables()
  const { host, filler, rng, playerLevel, isHostEquipped, isLadder } = params

  const fillerCode = filler.code.trim().toLowerCase()
  const hostCode = host.code.trim()
  const hostBase = tables.getBase(hostCode)
  if (!hostBase) {
    return { ok: false, reason: 'invalid_host' }
  }
  if (host.identified === false || filler.identified === false) {
    return { ok: false, reason: 'unidentified' }
  }
  if (!isSocketableFiller({ code: fillerCode } as unknown as Item)) {
    return { ok: false, reason: 'invalid_filler' }
  }
  const applyType = resolveGemApplyType(hostBase)
  if (applyType === -1) {
    return { ok: false, reason: 'invalid_host' }
  }

  const totalSockets = host.totalSockets ?? 0
  const prevChildren = host.socketedItems ?? []
  if (totalSockets <= 0 || prevChildren.length >= totalSockets) {
    return { ok: false, reason: 'no_free_sockets' }
  }

  const socketIndex = prevChildren.length
  const isCompactFiller = Boolean(CANONICAL_GEMS_TABLE.get(fillerCode))
  const fillerBaseFlags = Number(filler.rawFlags ?? filler.flags ?? ITEM_FLAG_IDENTIFIED)
  const childFlags =
    (((fillerBaseFlags | ITEM_FLAG_IDENTIFIED | ITEM_FLAG_INSOCKET) &
      ~ITEM_FLAG_RUNEWORD &
      ~(isCompactFiller ? 0 : ITEM_FLAG_COMPACT)) |
      (isCompactFiller ? ITEM_FLAG_COMPACT : 0)) >>>
    0

  const socketChild: ItemData = {
    ...filler,
    opcode: 0x9d,
    action: 0x0a,
    ownerType: 4,
    ownerId: host.id,
    location: 6,
    container: 'socket',
    bodyLoc: 0,
    equippedSlot: 0,
    storePage: 0,
    storagePage: 0,
    gridX: socketIndex,
    gridY: 0,
    x: socketIndex,
    y: 0,
    inSocket: true,
    equipped: false,
    identified: true,
    compact: isCompactFiller,
    simple: isCompactFiller,
    flags: childFlags,
    rawFlags: childFlags,
    stats: isCompactFiller ? [] : [...(filler.stats ?? [])],
  }

  const nextChildren = [...prevChildren, socketChild]
  const hostQuality = host.quality ?? 2
  const isNormalTierQuality = hostQuality === 1 || hostQuality === 2 || hostQuality === 3

  let runewordMatch: RunewordMatchResult | undefined
  if (
    !host.runeword &&
    isNormalTierQuality &&
    nextChildren.length === totalSockets &&
    nextChildren.every((c) => isRuneCode(c.code.trim().toLowerCase()))
  ) {
    const runeCodes = nextChildren.map((c) => c.code.trim().toLowerCase())
    const domainStub = buildDomainStubForRunewordCheck(host, hostBase, totalSockets)
    runewordMatch = checkRunewordMatch(
      domainStub,
      runeCodes,
      tables.isA,
      CANONICAL_RUNES_TABLE,
      { isLadder },
    )
  }

  if (isHostEquipped) {
    const hostReq = computeSingleItemReqLevel113c(host, tables)
    const fillerReq = computeSingleItemReqLevel113c(filler, tables)
    let rwReq = 0
    if (runewordMatch) {
      for (const rc of runewordMatch.runes) {
        const r = RUNE_INFO[rc]?.reqLevel ?? 0
        if (r > rwReq) rwReq = r
      }
    }
    const resultingReq = Math.max(hostReq, fillerReq, rwReq)
    if (playerLevel < resultingReq) {
      return { ok: false, reason: 'level_requirement' }
    }
  }

  let runewordStats: ItemStat[] = [...(host.runewordStats ?? [])]
  let isRuneword = Boolean(host.runeword)
  let runewordData = host.runewordData

  if (runewordMatch) {
    const rolledProps = rollPropList113c(runewordMatch.t1Codes, rng)
    runewordStats = propsToWireItemStats(rolledProps, hostCode)
    isRuneword = true
    runewordData = 0x5000 | ((runewordMatch.runewordId + 27) & 0xfff)
  }

  const ownStats = [...(host.stats ?? [])]
  const allChildStats: ItemStat[] = []
  for (const child of nextChildren) {
    allChildStats.push(...resolveGemSocketItemStats113c(child, hostCode, tables))
  }
  const combinedStatList = [...ownStats, ...allChildStats, ...runewordStats]
  const combinedStatsMap = new Map<number, number>()
  for (const st of combinedStatList) {
    combinedStatsMap.set(st.statId, (combinedStatsMap.get(st.statId) ?? 0) + st.value)
  }

  // Wire `ItemData.defense` is `STAT_ARMORCLASS (31)` on the base stat list (before ac% / +ac);
  // runeword & socket filler `ac%`/`+ac` live in `runewordStats` and `socketedItems` (#1911).
  const nextDefense = host.defense
  const prevHostFlags = Number(host.rawFlags ?? host.flags ?? ITEM_FLAG_IDENTIFIED)
  const nextHostFlags =
    (((prevHostFlags | ITEM_FLAG_IDENTIFIED | ITEM_FLAG_SOCKETED) & ~ITEM_FLAG_COMPACT) |
      (isRuneword ? ITEM_FLAG_RUNEWORD : 0)) >>>
    0

  const hostItem: ItemData = {
    ...host,
    compact: false,
    simple: false,
    identified: true,
    socketed: true,
    runeword: isRuneword,
    ...(runewordData !== undefined ? { runewordData } : {}),
    flags: nextHostFlags,
    rawFlags: nextHostFlags,
    totalSockets,
    usedSockets: nextChildren.length,
    socketedChildCount: nextChildren.length,
    ...(nextDefense !== undefined ? { defense: nextDefense } : {}),
    stats: ownStats,
    runewordStats,
    socketedItems: nextChildren,
  }

  return {
    ok: true,
    hostItem,
    socketChild,
    socketIndex,
    runewordMatch,
    combinedStatsMap,
  }
}

// ============================================================================
// Horadric Cube Engine (`#1829`, 146 `Cubemain.txt` `enabled=1` recipes)
// ============================================================================

export interface CubePortalSpawnSpec113c {
  readonly kind: 'cow' | 'pandemonium' | 'pandemonium_finale'
  readonly classId: 60
  readonly destAreaId: number
}

export interface ExecuteCubeTransmuteContext113c {
  readonly cubeItems: readonly ItemData[]
  readonly rng: D2Rng
  readonly playerLevel: number
  readonly playerClassCode: string
  readonly difficulty: 0 | 1 | 2
  readonly areaId: number
  readonly isLadder: boolean
  readonly isExpansion?: boolean | undefined
  readonly hasCompletedBaal?: boolean | undefined
  readonly hasActiveCowPortal?: boolean | undefined
  readonly openedPortalDestAreas?: ReadonlySet<number> | undefined
  readonly allocateUnitId: () => number
  readonly tables?: DropTables | undefined
  readonly recipes?: readonly CubemainRecipeRow113c[] | undefined
}

export interface PlacedCubeItem113c {
  readonly item: ItemData
  readonly x: number
  readonly y: number
}

export interface ExecuteCubeTransmuteResult113c {
  readonly matched: boolean
  readonly recipe?: CubemainRecipeRow113c | undefined
  readonly consumedItemIds: readonly number[]
  readonly createdItems: readonly PlacedCubeItem113c[]
  readonly portalToSpawn?: CubePortalSpawnSpec113c | undefined
}

interface ParsedInputDescriptor113c {
  readonly raw: string
  readonly isUniqueByName: boolean
  readonly primary: string
  readonly qty: number
  readonly upg: boolean
  readonly quality?: number | undefined
  readonly nos: boolean
  readonly sock: boolean
  readonly sockCount?: number | undefined
  readonly eth: boolean
  readonly noe: boolean
  readonly bas: boolean
  readonly exc: boolean
  readonly eli: boolean
  readonly nru: boolean
}

function parseInputDescriptor113c(
  rawSpec: string,
  tables: DropTables,
): ParsedInputDescriptor113c {
  const trimmed = rawSpec.trim()
  if (!trimmed.includes(',') && tables.uniques.get(trimmed) !== undefined) {
    return {
      raw: trimmed,
      isUniqueByName: true,
      primary: trimmed,
      qty: 1,
      upg: false,
      quality: 7,
      nos: false,
      sock: false,
      eth: false,
      noe: false,
      bas: false,
      exc: false,
      eli: false,
      nru: false,
    }
  }

  const parts = trimmed.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  const primary = parts[0] ?? 'any'
  let qty = 1
  let upg = false
  let quality: number | undefined
  let nos = false
  let sock = false
  let sockCount: number | undefined
  let eth = false
  let noe = false
  let bas = false
  let exc = false
  let eli = false
  let nru = false

  for (let i = 1; i < parts.length; i++) {
    const tok = parts[i]!
    if (tok.startsWith('qty=')) {
      const n = Number(tok.slice(4))
      if (Number.isFinite(n) && n > 0) qty = Math.trunc(n)
    } else if (tok === 'upg') upg = true
    else if (tok === 'low') quality = 1
    else if (tok === 'nor') quality = 2
    else if (tok === 'hiq') quality = 3
    else if (tok === 'mag') quality = 4
    else if (tok === 'set') quality = 5
    else if (tok === 'rar') quality = 6
    else if (tok === 'uni') quality = 7
    else if (tok === 'crf') quality = 8
    else if (tok === 'tmp') quality = 9
    else if (tok === 'nos') nos = true
    else if (tok === 'sock') sock = true
    else if (tok.startsWith('sock=')) {
      sock = true
      const n = Number(tok.slice(5))
      if (Number.isFinite(n) && n >= 0) sockCount = Math.trunc(n)
    } else if (tok === 'eth') eth = true
    else if (tok === 'noe') noe = true
    else if (tok === 'bas') bas = true
    else if (tok === 'exc') exc = true
    else if (tok === 'eli') eli = true
    else if (tok === 'nru') nru = true
  }

  return {
    raw: trimmed,
    isUniqueByName: false,
    primary,
    qty,
    upg,
    quality,
    nos,
    sock,
    sockCount,
    eth,
    noe,
    bas,
    exc,
    eli,
    nru,
  }
}

function itemMatchesType113c(
  base: ItemBase,
  targetType: string,
  tables: DropTables,
): boolean {
  const want = targetType.trim().toLowerCase()
  const candidates = new Set<string>()
  if (base.type) candidates.add(base.type.trim().toLowerCase())
  if (base.type2) candidates.add(base.type2.trim().toLowerCase())
  if (Array.isArray(base.tags)) {
    for (const tag of base.tags) {
      if (tag) candidates.add(tag.trim().toLowerCase())
    }
  }
  for (const c of candidates) {
    if (c === want || tables.isA(c, want)) return true
  }
  return false
}

function itemMatchesDescriptor113c(
  item: ItemData,
  desc: ParsedInputDescriptor113c,
  recipe: CubemainRecipeRow113c,
  tables: DropTables,
): boolean {
  const code = item.code.trim().toLowerCase()
  const base = tables.getBase(code)
  if (!base) return false

  if (desc.isUniqueByName) {
    const wantUnique = tables.uniques.get(desc.primary)
    if (!wantUnique) return false
    return (item.quality ?? 2) === 7 && item.uniqueItemId === wantUnique.id
  }

  if (desc.primary !== 'any') {
    const exactBase = tables.getBase(desc.primary)
    if (exactBase) {
      if (desc.upg) {
        if (isQuestItemBase113c(base) || isQuestItemBase113c({ code })) {
          return false
        }
        const targetNorm = (
          (exactBase as { readonly normcode?: string }).normcode ?? exactBase.id
        )
          .trim()
          .toLowerCase()
        const itemNorm = (
          (base as { readonly normcode?: string }).normcode ?? base.id
        )
          .trim()
          .toLowerCase()
        if (code !== desc.primary && itemNorm !== targetNorm) {
          return false
        }
      } else if (code !== desc.primary) {
        return false
      }
    } else if (!itemMatchesType113c(base, desc.primary, tables)) {
      return false
    } else if (isQuestItemBase113c(base) || isQuestItemBase113c({ code })) {
      return false
    }
  }

  const q = item.quality ?? 2
  if (desc.quality !== undefined && q !== desc.quality) {
    return false
  }

  const totalSockets = item.totalSockets ?? 0
  const filledSockets = item.socketedItems?.length ?? 0
  const isSocketed = Boolean(item.socketed || totalSockets > 0 || filledSockets > 0)
  if (desc.nos && isSocketed) return false
  if (desc.sock) {
    if (!isSocketed) return false
    if (desc.sockCount !== undefined && totalSockets !== desc.sockCount) return false
    if (recipe.output.toLowerCase().includes('uns') && filledSockets <= 0) return false
  }

  const isEth = Boolean(item.ethereal)
  if (desc.eth && !isEth) return false
  if (desc.noe && isEth) return false
  if (desc.nru && Boolean(item.runeword)) return false

  const normcode = ((base as { readonly normcode?: string }).normcode ?? base.id)
    .trim()
    .toLowerCase()
  const ubercode = ((base as { readonly ubercode?: string }).ubercode ?? '')
    .trim()
    .toLowerCase()
  const ultracode = ((base as { readonly ultracode?: string }).ultracode ?? '')
    .trim()
    .toLowerCase()

  if (desc.bas && code !== normcode) return false
  if (desc.exc && (!ubercode || code !== ubercode)) return false
  if (desc.eli && (!ultracode || code !== ultracode)) return false

  return true
}

function matchCubeInputsToRecipe113c(
  cubeItems: readonly ItemData[],
  recipe: CubemainRecipeRow113c,
  tables: DropTables,
): { readonly primaryItem: ItemData } | null {
  if (cubeItems.length !== recipe.numInputs) return null
  const descriptors = recipe.inputs.map((raw) => parseInputDescriptor113c(raw, tables))
  const slots: ParsedInputDescriptor113c[] = []
  for (const d of descriptors) {
    for (let k = 0; k < d.qty; k++) {
      slots.push(d)
    }
  }
  if (slots.length !== cubeItems.length) return null

  const used = new Array<boolean>(cubeItems.length).fill(false)
  let primaryItem: ItemData | undefined

  const backtrack = (slotIdx: number): boolean => {
    if (slotIdx >= slots.length) return true
    const desc = slots[slotIdx]!
    for (let i = 0; i < cubeItems.length; i++) {
      if (used[i]) continue
      const candidate = cubeItems[i]!
      if (!itemMatchesDescriptor113c(candidate, desc, recipe, tables)) continue
      used[i] = true
      if (slotIdx === 0) primaryItem = candidate
      if (backtrack(slotIdx + 1)) return true
      used[i] = false
    }
    return false
  }

  if (!backtrack(0) || !primaryItem) return null
  return { primaryItem }
}

function passesRecipeOp113c(
  recipe: CubemainRecipeRow113c,
  cubeItems: readonly ItemData[],
  difficulty: 0 | 1 | 2,
): boolean {
  if (recipe.op === 0) return true
  if (recipe.op === 28) {
    // D2Game.dll 0x6FC90EA0: quest items stamped with `item_questitemdifficulty` (stat 356)
    // cannot be transmuted in a higher/mismatched difficulty.
    for (const item of cubeItems) {
      const diffStat = item.stats?.find((s) => s.statId === STAT_QUEST_ITEM_DIFFICULTY)
      if (diffStat !== undefined && diffStat.value < difficulty) {
        return false
      }
      if (diffStat !== undefined && diffStat.value !== difficulty) {
        return false
      }
    }
    return true
  }
  return true
}

function computeCubeOutputIlvl113c(
  lvl: number,
  plvl: number,
  ilvlPct: number,
  playerLevel: number,
  primaryIlvl: number,
): number {
  if (lvl > 0) return Math.max(1, Math.min(99, lvl))
  if (plvl > 0 || ilvlPct > 0) {
    const computed =
      Math.floor((playerLevel * plvl) / 100) + Math.floor((primaryIlvl * ilvlPct) / 100)
    return Math.max(1, Math.min(99, computed))
  }
  return Math.max(1, Math.min(99, primaryIlvl || 1))
}

function createRolledAffixFromMagicAffix113c(
  affix: MagicAffix,
  rng: D2Rng,
): RolledAffix {
  const mods: RolledMod[] = []
  for (const m of affix.mods) {
    const code = m.code.trim()
    if (!code) continue
    let val: number
    if (isCoupledRangePropCode(code) || m.min === m.max) {
      val = m.min
    } else {
      const lo = Math.min(m.min, m.max)
      const hi = Math.max(m.min, m.max)
      val = rng.randRange(lo, hi)
    }
    mods.push({
      code,
      ...(m.param !== undefined && String(m.param).trim() !== ''
        ? { param: String(m.param) }
        : {}),
      min: m.min,
      max: m.max,
      value: val,
    })
  }
  return {
    affix,
    name: affix.name,
    isPrefix: Boolean(affix.isPrefix),
    group: affix.group,
    level: affix.level,
    levelreq: affix.levelreq,
    ...(affix.classspecific ? { classspecific: affix.classspecific } : {}),
    ...(affix.class ? { class: affix.class } : {}),
    ...(affix.classlevelreq ? { classlevelreq: affix.classlevelreq } : {}),
    mods,
    id: affix.id,
  }
}

function rollCraftedAffixes113c(
  base: ItemBase,
  outIlvl: number,
  tables: DropTables,
  rng: D2Rng,
  isExpansion: boolean,
): GeneratedRareAffixes {
  const qlvl = getBaseQlvl(base)
  const magicLvl = getBaseMagicLvl(base)
  const alvl = calculateAlvl(outIlvl, qlvl, magicLvl)
  const itemTypeCode = getItemTypeCode(base)
  const rawItemClass = (base as { readonly class?: string }).class
  const itemClass =
    typeof rawItemClass === 'string' && rawItemClass.trim()
      ? rawItemClass.trim().toLowerCase()
      : undefined

  // 1.13c D2Game.dll 0x6FC924E0: crafted items roll 1..4 random rare-eligible affixes:
  // base 1 + (ilvl>=31 ? 1 : 20%) + (ilvl>=51 ? 1 : 20%) + (ilvl>=71 ? 1 : 20%).
  let targetAffixCount = 1
  if (outIlvl >= 31 || rng.rand(5) === 0) targetAffixCount++
  if (outIlvl >= 51 || rng.rand(5) === 0) targetAffixCount++
  if (outIlvl >= 71 || rng.rand(5) === 0) targetAffixCount++
  targetAffixCount = Math.max(1, Math.min(4, targetAffixCount))

  const eligPre = tables.rareNames.prefixes.entries.filter((e) =>
    isRareNameEligible(e, itemTypeCode, tables.isA),
  )
  const eligSuf = tables.rareNames.suffixes.entries.filter((e) =>
    isRareNameEligible(e, itemTypeCode, tables.isA),
  )
  const rarePrefix: RareNameEntry =
    (eligPre.length > 0 ? eligPre[rng.rand(eligPre.length)] : tables.rareNames.prefixes.entries[0])!
  const rareSuffix: RareNameEntry =
    (eligSuf.length > 0 ? eligSuf[rng.rand(eligSuf.length)] : tables.rareNames.suffixes.entries[0])!

  const usedGroups = new Set<number>()
  const usedAffixes = new Set<MagicAffix>()
  const prefixes: RolledAffix[] = []
  const suffixes: RolledAffix[] = []

  const tryPick = (wantPrefix: boolean): boolean => {
    const sideArr = wantPrefix ? prefixes : suffixes
    if (sideArr.length >= 3) return false
    const pool = (wantPrefix ? tables.magicAffixes.prefixes.all : tables.magicAffixes.suffixes.all).filter(
      (a) =>
        !usedAffixes.has(a) &&
        !(a.group > 0 && usedGroups.has(a.group)) &&
        isAffixEligible(a, itemTypeCode, tables.isA, {
          alvl,
          isRare: true,
          ...(itemClass !== undefined ? { itemClass } : {}),
        }),
    )
    if (pool.length === 0) return false
    let totalWeight = 0
    for (const a of pool) {
      totalWeight += Math.max(1, a.frequency || 1)
    }
    let roll = rng.rand(totalWeight)
    let picked = pool[0]!
    for (const a of pool) {
      const w = Math.max(1, a.frequency || 1)
      if (roll < w) {
        picked = a
        break
      }
      roll -= w
    }
    usedAffixes.add(picked)
    if (picked.group > 0) usedGroups.add(picked.group)
    sideArr.push(createRolledAffixFromMagicAffix113c(picked, rng))
    return true
  }

  let preFull = false
  let sufFull = false
  for (let slot = 0; slot < targetAffixCount; slot++) {
    let pickPre: boolean
    if (preFull) {
      if (sufFull) break
      pickPre = false
    } else if (sufFull) {
      pickPre = true
    } else {
      pickPre = rng.rand(2) === 0
    }
    if (pickPre) {
      if (tryPick(true)) {
        if (prefixes.length >= 3) preFull = true
      } else {
        preFull = true
        slot--
      }
    } else {
      if (tryPick(false)) {
        if (suffixes.length >= 3) sufFull = true
      } else {
        sufFull = true
        slot--
      }
    }
  }

  return {
    name: `${rarePrefix.name} ${rareSuffix.name}`.trim(),
    alvl,
    rarePrefix,
    rareSuffix,
    prefix: prefixes[0] ?? null,
    suffix: suffixes[0] ?? null,
    prefixes,
    suffixes,
    affixes: [...prefixes, ...suffixes],
    baseName: base.name,
  }
}

function buildUseitemOutput113c(
  primary: ItemData,
  outSpec: string,
  mods: readonly CubemainMod113c[],
  rng: D2Rng,
  tables: DropTables,
): ItemData | null {
  const parts = outSpec.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  const hasUns = parts.includes('uns')
  const hasRep = parts.includes('rep')
  const hasRch = parts.includes('rch')
  const hasExc = parts.includes('exc')
  const hasEli = parts.includes('eli')
  const sockTok = parts.find((p) => p.startsWith('sock='))
  const qtyTok = parts.find((p) => p.startsWith('qty='))

  const curCode = primary.code.trim()
  const curBase = tables.getBase(curCode)
  if (!curBase) return null

  // 1. Hel + Scroll of TP + Socketed Item -> Unsocket (`useitem,uns`, Row 141)
  if (hasUns) {
    if ((primary.socketedItems?.length ?? 0) <= 0) return null
    const restoredDef = primary.defense
    const cleanFlags =
      (((Number(primary.rawFlags ?? primary.flags ?? ITEM_FLAG_IDENTIFIED) |
        ITEM_FLAG_SOCKETED |
        ITEM_FLAG_IDENTIFIED) &
        ~ITEM_FLAG_RUNEWORD) >>>
        0)
    const next: ItemData = {
      ...primary,
      socketed: true,
      runeword: false,
      usedSockets: 0,
      socketedChildCount: 0,
      socketedItems: [],
      runewordStats: [],
      flags: cleanFlags,
      rawFlags: cleanFlags,
      ...(restoredDef !== undefined ? { defense: restoredDef } : {}),
    }
    delete (next as { runewordData?: number }).runewordData
    return next
  }

  // 2. Repair & Recharge (`useitem,rep,qty=255` & `useitem,rep,rch,qty=255`, Rows 137..140)
  if (hasRep) {
    if (primary.ethereal) return null
    const maxDur = primary.maxDurability ?? baseDurability113c(curBase)
    const rechargeChargedStat = <T extends { readonly statId: number; readonly value: number }>(st: T): T => {
      if (hasRch && st.statId === STAT_ITEM_CHARGED_SKILL) {
        const maxCharges = (st.value >>> 8) & 0xff
        const fullCharges = maxCharges > 0 ? maxCharges : st.value & 0xff
        return {
          ...st,
          value: ((fullCharges & 0xff) << 8) | (fullCharges & 0xff),
        }
      }
      if (qtyTok && baseStackable113c(curBase) && st.statId === STAT_QUANTITY) {
        return { ...st, value: curBase.maxStack || 1 }
      }
      return st
    }
    const nextStats = (primary.stats ?? []).map(rechargeChargedStat)
    const nextRunewordStats =
      hasRch && primary.runewordStats !== undefined
        ? primary.runewordStats.map(rechargeChargedStat)
        : primary.runewordStats
    const nextQty =
      qtyTok && baseStackable113c(curBase)
        ? Math.max(primary.quantity ?? 1, curBase.maxStack || 1)
        : primary.quantity
    const cleanFlags =
      (Number(primary.rawFlags ?? primary.flags ?? ITEM_FLAG_IDENTIFIED) & ~0x100) >>> 0
    return {
      ...primary,
      broken: false,
      ...(maxDur > 0 ? { durability: maxDur, curDurability: maxDur, maxDurability: maxDur } : {}),
      ...(nextQty !== undefined ? { quantity: nextQty } : {}),
      flags: cleanFlags,
      rawFlags: cleanFlags,
      stats: nextStats,
      ...(nextRunewordStats !== undefined ? { runewordStats: nextRunewordStats } : {}),
    }
  }

  // 3. Unique & Rare Base Tier Upgrade (`useitem,mod,exc` & `useitem,mod,eli`, Rows 129..136)
  if (hasExc || hasEli) {
    if (isQuestItemBase113c(curBase) || isQuestItemBase113c({ code: curCode })) return null
    const nextCodeRaw = hasEli
      ? (curBase as { readonly ultracode?: string }).ultracode
      : (curBase as { readonly ubercode?: string }).ubercode
    const nextCode = (nextCodeRaw ?? '').trim()
    if (!nextCode || nextCode.toLowerCase() === curCode.toLowerCase()) return null
    const nextBase = tables.getBase(nextCode)
    if (!nextBase) return null

    const rolledMods = rollPropList113c(mods, rng)
    const modStats = propsToWireItemStats(rolledMods, nextCode)
    const mergedStats = [...(primary.stats ?? [])]
    for (const ms of modStats) {
      const idx = mergedStats.findIndex((s) => s.statId === ms.statId && (s.param ?? 0) === (ms.param ?? 0))
      if (idx !== -1) {
        mergedStats[idx] = { ...mergedStats[idx]!, value: mergedStats[idx]!.value + ms.value }
      } else {
        mergedStats.push(ms)
      }
    }

    let nextDefense = primary.defense
    if (nextBase.kind === 'armor') {
      const minAc = Number((nextBase as { readonly minac?: number }).minac ?? nextBase.defense ?? 1)
      const maxAc = Number((nextBase as { readonly maxac?: number }).maxac ?? nextBase.defense ?? minAc)
      let baseAc = minAc === maxAc ? minAc : rng.randRange(Math.min(minAc, maxAc), Math.max(minAc, maxAc))
      if (primary.ethereal) {
        baseAc = Math.floor((baseAc * 3) / 2)
      }
      // Wire `ItemData.defense` stores baseAc (including 1.5x ethereal) BEFORE `ac%`/`+ac` (#1911).
      nextDefense = baseAc
    }

    const nextMaxDur = baseDurability113c(nextBase) || Number(primary.maxDurability ?? 0)
    const nextCurDur =
      nextMaxDur > 0
        ? Math.min(nextMaxDur, Math.max(1, primary.durability ?? nextMaxDur))
        : primary.durability

    return {
      ...primary,
      code: nextCode,
      rawCode: nextCode.padEnd(4, ' ').slice(0, 4),
      invWidth: nextBase.invWidth,
      invHeight: nextBase.invHeight,
      ...(nextDefense !== undefined ? { defense: nextDefense } : {}),
      ...(nextMaxDur > 0
        ? { maxDurability: nextMaxDur, durability: nextCurDur, curDurability: nextCurDur }
        : {}),
      stats: mergedStats,
    }
  }

  // 4. Socket Punching (`useitem,sock=1` Row 63 & `useitem` with `mod 1 = sock` Rows 123..126)
  const sockMod = mods.find((m) => m.code.trim().toLowerCase() === 'sock')
  if (sockTok || sockMod) {
    if (primary.socketed || (primary.totalSockets ?? 0) > 0) return null
    const baseMaxSockets = Number(
      (curBase as { readonly gemsockets?: number }).gemsockets ?? 0,
    )
    if (baseMaxSockets <= 0) return null
    const typeDef = tables.itemTypes.byCode.get((curBase.type ?? '').trim().toLowerCase())
    const maxAllowed = typeDef
      ? getMaxSockets(baseMaxSockets, typeDef, primary.ilvl ?? 1)
      : baseMaxSockets
    if (maxAllowed <= 0) return null

    let rolledSockets: number
    if (sockTok) {
      rolledSockets = Math.max(1, Number(sockTok.slice(5)) || 1)
    } else {
      const lo = Math.max(1, Math.min(sockMod!.min, sockMod!.max))
      const hi = Math.max(lo, Math.max(sockMod!.min, sockMod!.max))
      rolledSockets = rng.randRange(lo, hi)
    }
    const invCap = Math.max(1, (curBase.invWidth || 1) * (curBase.invHeight || 1))
    const finalSockets = Math.max(1, Math.min(rolledSockets, invCap, maxAllowed))

    // 1.13c D2Game.dll 0x6FC91B20: cube socketing (`mod = sock`, Rows 123..126) preserves rolled
    // base defense and re-applies the +50% ethereal defense bonus ("ebug") on ethereal normal armor (#1909).
    let nextDefense = primary.defense
    if (curBase.kind === 'armor') {
      const startDef =
        typeof primary.defense === 'number'
          ? primary.defense
          : curBase.defense > 0
            ? primary.ethereal
              ? Math.floor((curBase.defense * 3) / 2)
              : curBase.defense
            : undefined
      if (startDef !== undefined) {
        nextDefense = Boolean(sockMod) && primary.ethereal ? Math.floor((startDef * 3) / 2) : startDef
      }
    }

    const nextFlags =
      ((Number(primary.rawFlags ?? primary.flags ?? ITEM_FLAG_IDENTIFIED) |
        ITEM_FLAG_SOCKETED |
        ITEM_FLAG_IDENTIFIED) &
        ~ITEM_FLAG_COMPACT) >>>
      0

    return {
      ...primary,
      compact: false,
      simple: false,
      socketed: true,
      totalSockets: finalSockets,
      usedSockets: 0,
      socketedChildCount: 0,
      ...(nextDefense !== undefined ? { defense: nextDefense } : {}),
      flags: nextFlags,
      rawFlags: nextFlags,
    }
  }

  return null
}

function resolveOutputBase113c(
  baseToken: string,
  primary: ItemData,
  outIlvl: number,
  rng: D2Rng,
  tables: DropTables,
): ItemBase | null {
  if (baseToken === 'usetype') {
    return tables.getBase(primary.code.trim()) ?? null
  }
  const direct = tables.getBase(baseToken)
  if (direct) return direct

  // ItemType output token (e.g. `pole` in Row 19 Savage Polearm recipe)
  const allBases: ItemBase[] = [
    ...tables.weapons.all,
    ...tables.armor.all,
    ...tables.misc.all,
  ]
  const matching = allBases.filter(
    (b) =>
      b.spawnable !== false &&
      itemMatchesType113c(b, baseToken, tables) &&
      ((b as { readonly normcode?: string }).normcode === undefined ||
        b.id.toLowerCase() ===
          ((b as { readonly normcode?: string }).normcode ?? '').toLowerCase() ||
        (b.level ?? 0) <= outIlvl),
  )
  const levelFiltered = matching.filter((b) => (b.level ?? 0) <= outIlvl)
  const pool = levelFiltered.length > 0 ? levelFiltered : matching
  if (pool.length === 0) return null
  return pool[rng.rand(pool.length)]!
}

function buildCreatedOutput113c(
  outSpec: string,
  lvl: number,
  plvl: number,
  ilvlPct: number,
  mods: readonly CubemainMod113c[],
  primary: ItemData,
  ctx: ExecuteCubeTransmuteContext113c,
  tables: DropTables,
): ItemData | null {
  const parts = outSpec.split(',').map((s) => s.trim()).filter(Boolean)
  if (parts.length === 0) return null
  const token0 = parts[0]!.toLowerCase()
  if (token0 === 'useitem') {
    return buildUseitemOutput113c(primary, outSpec, mods, ctx.rng, tables)
  }

  const outIlvl = computeCubeOutputIlvl113c(
    lvl,
    plvl,
    ilvlPct,
    ctx.playerLevel,
    primary.ilvl ?? 1,
  )
  const outBase = resolveOutputBase113c(token0, primary, outIlvl, ctx.rng, tables)
  if (!outBase) return null

  const outCode = outBase.id.trim()
  const lowerTokens = parts.slice(1).map((p) => p.toLowerCase())
  const isCrf = lowerTokens.includes('crf')
  const isRar = lowerTokens.includes('rar')
  const isMag = lowerTokens.includes('mag')
  const isLow = lowerTokens.includes('low')
  const preTok = lowerTokens.find((p) => p.startsWith('pre='))
  const sufTok = lowerTokens.find((p) => p.startsWith('suf='))

  let rolledSockets = 0
  const sockMod = mods.find((m) => m.code.trim().toLowerCase() === 'sock')
  if (sockMod) {
    const baseMax = Number((outBase as { readonly gemsockets?: number }).gemsockets ?? 0)
    const typeDef = tables.itemTypes.byCode.get((outBase.type ?? '').trim().toLowerCase())
    const maxAllowed = typeDef ? getMaxSockets(baseMax, typeDef, outIlvl) : baseMax
    if (maxAllowed > 0) {
      const lo = Math.max(1, Math.min(sockMod.min, sockMod.max))
      const hi = Math.max(lo, Math.max(sockMod.min, sockMod.max))
      rolledSockets = Math.min(maxAllowed, ctx.rng.randRange(lo, hi))
    }
  }

  const nonSockMods = mods.filter((m) => m.code.trim().toLowerCase() !== 'sock')
  const presetProps = rollPropList113c(nonSockMods, ctx.rng)
  const isExpansion = ctx.isExpansion !== false
  const unitId = ctx.allocateUnitId()

  // Quest synthesis outputs (`hst` Horadric Staff, `qf2` Khalim's Will)
  const questNum = Number((outBase as { readonly quest?: number }).quest ?? 0)
  const questDiffCheck = Boolean(
    (outBase as { readonly questDiffCheck?: boolean }).questDiffCheck,
  )
  const uniqueMatches = questNum > 0 ? tables.uniques.byCode.get(outCode) : undefined
  if (questNum > 0 && uniqueMatches && uniqueMatches.length > 0) {
    const uDef = uniqueMatches[0]!
    const uProps = rollPropList113c(
      uDef.props.map((p) => ({
        code: p.code,
        param: p.par,
        min: p.min,
        max: p.max,
      })),
      ctx.rng,
    )
    const stats = propsToWireItemStats([...uProps, ...presetProps], outCode)
    if (questDiffCheck) {
      stats.push({ statId: STAT_QUEST_ITEM_DIFFICULTY, param: 0, value: ctx.difficulty })
    }
    const maxDur = baseDurability113c(outBase)
    const rawFlags = ITEM_FLAG_IDENTIFIED >>> 0
    return {
      id: unitId as UnitId,
      itemId: unitId as UnitId,
      opcode: 0x9c,
      action: 0x04,
      category: 0,
      ownerType: 0,
      ownerId: 0,
      flags: rawFlags,
      rawFlags,
      version: 101,
      location: 0,
      container: 'cube',
      bodyLoc: 0,
      equippedSlot: 0,
      gridX: 0,
      gridY: 0,
      storePage: 4,
      storagePage: 4,
      worldX: 0,
      worldY: 0,
      x: 0,
      y: 0,
      code: outCode,
      rawCode: outCode.padEnd(4, ' ').slice(0, 4),
      compact: false,
      simple: false,
      identified: true,
      socketed: false,
      ethereal: false,
      runeword: false,
      personalized: false,
      isEar: false,
      newItem: true,
      starterItem: false,
      broken: false,
      inSocket: false,
      equipped: false,
      socketedChildCount: 0,
      usedSockets: 0,
      totalSockets: 0,
      ilvl: outIlvl,
      quality: 7 as WireItemQuality,
      uniqueItemId: uDef.id,
      ...(maxDur > 0 ? { durability: maxDur, curDurability: maxDur, maxDurability: maxDur } : {}),
      quantity: 1,
      invWidth: outBase.invWidth,
      invHeight: outBase.invHeight,
      stats,
      setBonusStats: [],
      runewordStats: [],
    }
  }

  // Crafted items (`usetype,crf`, Rows 64..99)
  if (isCrf) {
    const crafted = rollCraftedAffixes113c(outBase, outIlvl, tables, ctx.rng, isExpansion)
    const affixProps: RolledItemProp[] = []
    for (const a of crafted.affixes) {
      for (const m of a.mods) {
        affixProps.push({
          code: m.code,
          ...(m.param !== undefined ? { param: m.param } : {}),
          min: m.min,
          max: m.max,
          value: m.value,
        })
      }
    }
    const allProps = [...presetProps, ...affixProps]
    const defense =
      outBase.kind === 'armor'
        ? rollCubeArmorDefense113c(outBase, allProps, ctx.rng)
        : undefined
    const maxDur = baseDurability113c(outBase)
    const domainItem = {
      base: outBase,
      prefix: null,
      suffix: null,
      level: outIlvl,
      ilvl: outIlvl,
      name: crafted.name,
      stats: {},
      invWidth: outBase.invWidth,
      invHeight: outBase.invHeight,
      stack: 1,
      value: outBase.value,
      code: outCode,
      quality: ItemQuality.CRAFTED,
      rarity: 'crafted',
      identified: true,
      ...(defense !== undefined ? { defense } : {}),
      ...(maxDur > 0 ? { durability: maxDur, maxDurability: maxDur } : {}),
      ...(rolledSockets > 0 ? { totalSockets: rolledSockets, sockets: rolledSockets } : {}),
      rolledProps: allProps,
      rolledRareAffixes: crafted,
    } as unknown as Item
    return domainItemToItemData113c(domainItem, tables, {
      unitId,
      compactSave: false,
    })
  }

  // Rare reroll (`usetype,rar`, Rows 61..62)
  if (isRar) {
    const rare = rollRareAffixes(
      outBase,
      outIlvl,
      tables.magicAffixes,
      tables.rareNames,
      tables.isA,
      ctx.rng,
      { isExpansion },
    )
    const affixProps: RolledItemProp[] = []
    for (const a of rare.affixes) {
      for (const m of a.mods) {
        affixProps.push({
          code: m.code,
          ...(m.param !== undefined ? { param: m.param } : {}),
          min: m.min,
          max: m.max,
          value: m.value,
        })
      }
    }
    const allProps = [...presetProps, ...affixProps]
    const defense =
      outBase.kind === 'armor'
        ? rollCubeArmorDefense113c(outBase, allProps, ctx.rng)
        : undefined
    const maxDur = baseDurability113c(outBase)
    const domainItem = {
      base: outBase,
      prefix: null,
      suffix: null,
      level: outIlvl,
      ilvl: outIlvl,
      name: rare.name,
      stats: {},
      invWidth: outBase.invWidth,
      invHeight: outBase.invHeight,
      stack: 1,
      value: outBase.value,
      code: outCode,
      quality: ItemQuality.RARE,
      rarity: 'rare',
      identified: true,
      ...(defense !== undefined ? { defense } : {}),
      ...(maxDur > 0 ? { durability: maxDur, maxDurability: maxDur } : {}),
      ...(rolledSockets > 0 ? { totalSockets: rolledSockets, sockets: rolledSockets } : {}),
      rolledProps: allProps,
      rolledRareAffixes: rare,
    } as unknown as Item
    return domainItemToItemData113c(domainItem, tables, {
      unitId,
      compactSave: false,
    })
  }

  // Magic outputs (`usetype,mag`, `amu,mag,pre=331`, `pole,mag,pre=191`, `usetype,mag,suf=162`, etc.)
  if (isMag) {
    let magic: GeneratedAffixes
    if (preTok || sufTok) {
      const forcedPreId = preTok ? Number(preTok.slice(4)) : 0
      const forcedSufId = sufTok ? Number(sufTok.slice(4)) : 0
      const baseRoll = rollMagicAffixes(
        outBase,
        outIlvl,
        tables.magicAffixes,
        tables.isA,
        ctx.rng,
        { isExpansion },
      )
      const preDef = forcedPreId > 0
        ? tables.magicAffixes.prefixes.all.find((a) => a.id === forcedPreId)
        : undefined
      const sufDef = forcedSufId > 0
        ? tables.magicAffixes.suffixes.all.find((a) => a.id === forcedSufId)
        : undefined
      const finalPre = preDef
        ? createRolledAffixFromMagicAffix113c(preDef, ctx.rng)
        : (ctx.rng.rand(2) !== 0 ? baseRoll.prefix : null)
      const finalSuf = sufDef
        ? createRolledAffixFromMagicAffix113c(sufDef, ctx.rng)
        : (ctx.rng.rand(2) !== 0 ? baseRoll.suffix : null)
      const prefixes = finalPre ? [finalPre] : []
      const suffixes = finalSuf ? [finalSuf] : []
      magic = {
        name: [finalPre?.name, outBase.name, finalSuf?.name].filter(Boolean).join(' '),
        alvl: baseRoll.alvl,
        prefix: finalPre,
        suffix: finalSuf,
        prefixes,
        suffixes,
        affixes: [...prefixes, ...suffixes],
        baseName: outBase.name,
      }
    } else {
      magic = rollMagicAffixes(
        outBase,
        outIlvl,
        tables.magicAffixes,
        tables.isA,
        ctx.rng,
        { isExpansion },
      )
    }

    const affixProps: RolledItemProp[] = []
    for (const a of magic.affixes) {
      for (const m of a.mods) {
        affixProps.push({
          code: m.code,
          ...(m.param !== undefined ? { param: m.param } : {}),
          min: m.min,
          max: m.max,
          value: m.value,
        })
      }
    }
    const allProps = [...presetProps, ...affixProps]
    const defense =
      outBase.kind === 'armor'
        ? rollCubeArmorDefense113c(outBase, allProps, ctx.rng)
        : undefined
    const maxDur = baseDurability113c(outBase)
    const domainItem = {
      base: outBase,
      prefix: magic.prefix?.affix ?? null,
      suffix: magic.suffix?.affix ?? null,
      level: outIlvl,
      ilvl: outIlvl,
      name: magic.name,
      stats: {},
      invWidth: outBase.invWidth,
      invHeight: outBase.invHeight,
      stack: 1,
      value: outBase.value,
      code: outCode,
      quality: ItemQuality.MAGIC,
      rarity: 'magic',
      identified: true,
      ...(defense !== undefined ? { defense } : {}),
      ...(maxDur > 0 ? { durability: maxDur, maxDurability: maxDur } : {}),
      ...(rolledSockets > 0 ? { totalSockets: rolledSockets, sockets: rolledSockets } : {}),
      rolledProps: allProps,
      rolledMagicAffixes: magic,
    } as unknown as Item
    return domainItemToItemData113c(domainItem, tables, {
      unitId,
      compactSave: false,
    })
  }

  // Normal / Low quality outputs (Runes, Gems, Potions, Quivers, Token of Absolution, `tax,nor`, `jav,nor`, `usetype,nor`)
  const normIlvl =
    lvl === 0 && plvl === 0 && ilvlPct === 0 && token0 === 'usetype'
      ? 1
      : outIlvl
  const isCompactMisc =
    outBase.kind === 'misc' &&
    !baseStackable113c(outBase) &&
    presetProps.length === 0 &&
    rolledSockets === 0
  const defense =
    outBase.kind === 'armor'
      ? rollCubeArmorDefense113c(outBase, presetProps, ctx.rng)
      : undefined
  const maxDur = baseDurability113c(outBase)
  const quantity = baseStackable113c(outBase) ? Math.max(1, outBase.maxStack || 1) : 1
  const outQuality = isLow ? ItemQuality.LOW : ItemQuality.NORMAL
  const stats = propsToWireItemStats(presetProps, outCode)
  if (baseStackable113c(outBase)) {
    stats.push({ statId: STAT_QUANTITY, param: 0, value: quantity })
  }

  const rawFlags =
    (ITEM_FLAG_IDENTIFIED |
      (rolledSockets > 0 ? ITEM_FLAG_SOCKETED : 0) |
      (isCompactMisc ? ITEM_FLAG_COMPACT : 0)) >>>
    0

  return {
    id: unitId as UnitId,
    itemId: unitId as UnitId,
    opcode: 0x9c,
    action: 0x04,
    category: 0,
    ownerType: 0,
    ownerId: 0,
    flags: rawFlags,
    rawFlags,
    version: 101,
    location: 0,
    container: 'cube',
    bodyLoc: 0,
    equippedSlot: 0,
    gridX: 0,
    gridY: 0,
    storePage: 4,
    storagePage: 4,
    worldX: 0,
    worldY: 0,
    x: 0,
    y: 0,
    code: outCode,
    rawCode: outCode.padEnd(4, ' ').slice(0, 4),
    compact: isCompactMisc,
    simple: isCompactMisc,
    identified: true,
    socketed: rolledSockets > 0,
    ethereal: false,
    runeword: false,
    personalized: false,
    isEar: false,
    newItem: true,
    starterItem: false,
    broken: false,
    inSocket: false,
    equipped: false,
    socketedChildCount: 0,
    usedSockets: 0,
    totalSockets: rolledSockets,
    ilvl: normIlvl,
    quality: outQuality as WireItemQuality,
    ...(defense !== undefined ? { defense } : {}),
    ...(maxDur > 0 ? { durability: maxDur, curDurability: maxDur, maxDurability: maxDur } : {}),
    quantity,
    invWidth: outBase.invWidth,
    invHeight: outBase.invHeight,
    stats,
    setBonusStats: [],
    runewordStats: [],
  }
}

function packOutputsIntoCubeGrid113c(
  outputs: readonly ItemData[],
): PlacedCubeItem113c[] | null {
  const grid = Array.from({ length: 4 }, () => new Array<boolean>(3).fill(false))
  const placed: PlacedCubeItem113c[] = []

  for (const item of outputs) {
    const w = Math.max(1, item.invWidth ?? 1)
    const h = Math.max(1, item.invHeight ?? 1)
    let found: { x: number; y: number } | undefined
    for (let y = 0; y <= 4 - h && !found; y++) {
      for (let x = 0; x <= 3 - w && !found; x++) {
        let fits = true
        for (let dy = 0; dy < h && fits; dy++) {
          for (let dx = 0; dx < w; dx++) {
            if (grid[y + dy]![x + dx]) {
              fits = false
              break
            }
          }
        }
        if (fits) found = { x, y }
      }
    }
    if (!found) return null
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        grid[found.y + dy]![found.x + dx] = true
      }
    }
    placed.push({
      item: {
        ...item,
        location: 0,
        container: 'cube',
        storePage: 4,
        storagePage: 4,
        gridX: found.x,
        gridY: found.y,
        x: found.x,
        y: found.y,
      },
      x: found.x,
      y: found.y,
    })
  }
  return placed
}

/**
 * Evaluates and executes all 146 `enabled=1` recipes of 1.13c `Cubemain.txt` (`D2Game.dll` `0x6FC90AE0`).
 */
export function executeCubeTransmute113c(
  ctx: ExecuteCubeTransmuteContext113c,
): ExecuteCubeTransmuteResult113c {
  const { cubeItems } = ctx
  if (cubeItems.length === 0) {
    return { matched: false, consumedItemIds: [], createdItems: [] }
  }

  const tables = ctx.tables ?? getEmbeddedDropTables()
  const recipes = ctx.recipes ?? ENABLED_CUBEMAIN_RECIPES_113C
  const isExpansion = ctx.isExpansion !== false
  const playerClass = ctx.playerClassCode.trim().toLowerCase()

  for (const recipe of recipes) {
    if (!recipe.enabled) continue
    if (recipe.ladder && !ctx.isLadder) continue
    if (ctx.difficulty < recipe.minDiff) continue
    if (!isExpansion && recipe.version >= 100) continue
    if (recipe.classCode && recipe.classCode !== playerClass) continue
    if (!passesRecipeOp113c(recipe, cubeItems, ctx.difficulty)) continue

    const match = matchCubeInputsToRecipe113c(cubeItems, recipe, tables)
    if (!match) continue

    const outTrimmed = recipe.output.trim()
    const outLower = outTrimmed.toLowerCase()

    // Special Portal recipes (Rows 2, 148, 149)
    if (outLower === 'cow portal') {
      if (
        ctx.areaId !== 1 ||
        ctx.hasCompletedBaal !== true ||
        ctx.hasActiveCowPortal === true
      ) {
        return { matched: false, consumedItemIds: [], createdItems: [] }
      }
      return {
        matched: true,
        recipe,
        consumedItemIds: cubeItems.map((i) => i.id),
        createdItems: [],
        portalToSpawn: { kind: 'cow', classId: 60, destAreaId: 39 },
      }
    }

    if (outLower === 'pandemonium portal') {
      if (ctx.areaId !== 109 || ctx.difficulty !== 2) {
        return { matched: false, consumedItemIds: [], createdItems: [] }
      }
      const candidates = [133, 134, 135].filter(
        (id) => !ctx.openedPortalDestAreas?.has(id),
      )
      if (candidates.length === 0) {
        return { matched: false, consumedItemIds: [], createdItems: [] }
      }
      const destAreaId = candidates[ctx.rng.rand(candidates.length)]!
      return {
        matched: true,
        recipe,
        consumedItemIds: cubeItems.map((i) => i.id),
        createdItems: [],
        portalToSpawn: { kind: 'pandemonium', classId: 60, destAreaId },
      }
    }

    if (outLower === 'pandemonium finale portal') {
      if (
        ctx.areaId !== 109 ||
        ctx.difficulty !== 2 ||
        ctx.openedPortalDestAreas?.has(136)
      ) {
        return { matched: false, consumedItemIds: [], createdItems: [] }
      }
      return {
        matched: true,
        recipe,
        consumedItemIds: cubeItems.map((i) => i.id),
        createdItems: [],
        portalToSpawn: { kind: 'pandemonium_finale', classId: 60, destAreaId: 136 },
      }
    }

    const generated: ItemData[] = []
    const mainOut = buildCreatedOutput113c(
      recipe.output,
      recipe.lvl,
      recipe.plvl,
      recipe.ilvl,
      recipe.mods,
      match.primaryItem,
      ctx,
      tables,
    )
    if (!mainOut) continue
    generated.push(mainOut)

    if (recipe.outputB) {
      const outB = buildCreatedOutput113c(
        recipe.outputB,
        recipe.bLvl,
        recipe.bPlvl,
        recipe.bIlvl,
        [],
        match.primaryItem,
        ctx,
        tables,
      )
      if (outB) generated.push(outB)
    }

    if (recipe.outputC) {
      const outC = buildCreatedOutput113c(
        recipe.outputC,
        recipe.cLvl,
        recipe.cPlvl,
        recipe.cIlvl,
        [],
        match.primaryItem,
        ctx,
        tables,
      )
      if (outC) generated.push(outC)
    }

    const packed = packOutputsIntoCubeGrid113c(generated)
    if (!packed) continue

    return {
      matched: true,
      recipe,
      consumedItemIds: cubeItems.map((i) => i.id),
      createdItems: packed,
    }
  }

  return { matched: false, consumedItemIds: [], createdItems: [] }
}
