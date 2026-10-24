/**
 * Diablo II v1.13c set bonuses for the client stat engine (PROJECT.md rule 18, #752).
 *
 * `computeSetBonusStats(activeEquipped)` returns every set-bonus stat the player currently owns, in
 * internal (ItemStatCost `ValShift`) units, from:
 *  1. the item-specific set lists sent in each item's bitstream (SetItems.txt `aprop1a..aprop5b`,
 *     already rolled by the server; decoded with their mask index), enabled per SetItems.txt
 *     `add func` exactly like D2MOO `D2Common/src/Items/Items.cpp` `sub_6FDA4380` (#7424); and
 *  2. the Sets.txt partial (`PCode2a..PCode5b`) and full (`FCode1..FCode8`) bonuses, which live on a
 *     per-set statlist of the player (D2MOO `D2Common/src/Items/ItemMods.cpp`
 *     `ITEMMODS_UpdateFullSetBoni`, called from `Items.cpp` `sub_6FDA4490`). The server never sends
 *     that statlist (`STATLIST_SetState` does not toggle a unit state, so no 0xA8), so the 1.13c
 *     client derives it from the equipped set pieces itself; this module does the same.
 *
 * Counting follows D2MOO `Items.cpp` `ITEMS_GetSetItemsMask` (#10836): equipped items of the same
 * set, quality SET, not IFLAG_BROKEN; each contributes bit `SetItemsTxt.nSetItems` (the row's 0-based
 * position among its set's rows in file order, `DataTbls/ItemsTbls.cpp`). Only body locations 1..10
 * count (PROJECT.md rule 23): on a weapon swap the 1.13c server physically moves the items 4/5 <-> 11/12
 * (D2Game `ITEMS/ItemMode.cpp` `sub_6FC46840`) and the switch slots 11/12 never give stats
 * (`D2GAME_ITEMS_UpdateInventoryItems`: equip loop `i < 11`), so items at 11/12 are ignored whatever
 * `self.weaponSet` says; bodyLoc 0 (not equipped) is ignored as well.
 *
 * Known limitations (documented, never guessed):
 *  - Requirement gating (IFLAG_NOEQUIP for unmet str/dex/level) is out of scope (rule 15): ItemData
 *    lacks the fields.
 */

import { RAW_ITEM_TYPES, RAW_SET_ITEMS, RAW_SETS, RAW_WEAPONS } from '../../common/data/canonical-drop-data.ts'
import { CANONICAL_ENG_TBL_DICT } from '../../common/data/canonical-tbl-strings.ts'
import { RAW_ITEM_STAT_COST, RAW_PROPERTIES } from '../../common/data/canonical-vendor-data.ts'
import { SKILLS_CATALOG } from '../../common/data/skills-catalog.ts'
import {
  parseItemStatCostTable,
  parsePropertiesTable,
  type ItemStatCostTable,
  type PropertiesTable,
  type PropertyRecord,
} from '../../common/items/properties.ts'
import { parseSetItemsTable, parseSetsTable, type SetBonusProp } from '../../common/items/set-items.ts'
import { parseTable, type D2Table } from '../../common/world/acts.ts'
import type { ItemData, ItemStat } from '../../netproto/index.ts'
import { STATES_TXT_COLOR_ROWS } from './stat-engine/generated-states-skills.ts'

/** Item quality SET (D2 `ITEMQUAL_SET`). */
const ITEM_QUALITY_SET = 5

/**
 * Properties.txt functions that are deliberately not turned into stats (see module doc). The value
 * explains why; anything else that is unsupported throws.
 */
export const SET_BONUS_EXCLUDED_PROPERTY_FUNCS: ReadonlyMap<number, string> = new Map([])

interface SetItemInfo {
  readonly id: number
  readonly name: string
  readonly set: string
  readonly code: string
  /** 0-based position among the set's SetItems.txt rows (SetItemsTxt.nSetItems). */
  readonly position: number
  /** SetItems.txt `add func`. */
  readonly addFunc: number
}

interface SetInfo {
  readonly name: string
  /** Number of SetItems.txt rows of this set (SetsTxt.nSetItems). */
  readonly itemCount: number
  /** pBoni2[0..7] = PCode2a, 2b, 3a, 3b, 4a, 4b, 5a, 5b (null = empty column). */
  readonly partial: readonly (SetBonusProp | null)[]
  /** FCode1..8 up to (excluding) the first empty FCode column. */
  readonly full: readonly SetBonusProp[]
}

interface WeaponDamageInfo {
  readonly minDam: number
  readonly maxDam: number
  readonly twoHandMinDam: number
  readonly twoHandMaxDam: number
  readonly throwable: boolean
}

interface StatRef {
  readonly id: number
  readonly valShift: number
}

interface SetBonusTables {
  readonly setItemsById: ReadonlyMap<number, SetItemInfo>
  readonly setItemIdsByCode: ReadonlyMap<string, readonly number[]>
  readonly setItemIdByName: ReadonlyMap<string, number>
  readonly setsByName: ReadonlyMap<string, SetInfo>
  readonly properties: PropertiesTable
  readonly isc: ItemStatCostTable
  readonly weapons: ReadonlyMap<string, WeaponDamageInfo>
  readonly skillIdsByName: ReadonlyMap<string, number>
  readonly skillIds: ReadonlySet<number>
  readonly stateIdsByName: ReadonlyMap<string, number>
  readonly stateIds: ReadonlySet<number>
  readonly stats: {
    readonly mindamage: StatRef
    readonly secondaryMindamage: StatRef
    readonly throwMindamage: StatRef
    readonly maxdamage: StatRef
    readonly secondaryMaxdamage: StatRef
    readonly throwMaxdamage: StatRef
    readonly minDamagePercent: StatRef
    readonly maxDamagePercent: StatRef
    readonly poisonMaxDam: StatRef
    readonly poisonCount: StatRef
  }
}

let cachedTables: SetBonusTables | null = null

function headerIndex(table: D2Table, tableName: string): (column: string) => number {
  const map = new Map<string, number>()
  table.header.forEach((h, i) => map.set(h.trim().toLowerCase(), i))
  return (column: string): number => {
    const idx = map.get(column.toLowerCase())
    if (idx === undefined) {
      throw new Error(`set-bonuses: ${tableName} is missing column '${column}'`)
    }
    return idx
  }
}

function requireStat(isc: ItemStatCostTable, name: string): StatRef {
  const rec = isc.getByStat(name)
  if (!rec || !Number.isInteger(rec.id) || rec.id < 0) {
    throw new Error(`set-bonuses: ItemStatCost.txt has no stat '${name}'`)
  }
  return { id: rec.id, valShift: rec.valShift }
}

function parseIntStrict(raw: string, what: string): number {
  const t = raw.trim()
  if (t === '') return 0
  const n = Number.parseInt(t, 10)
  if (!Number.isFinite(n)) throw new Error(`set-bonuses: non-numeric ${what}: '${raw}'`)
  return n
}

function loadTables(): SetBonusTables {
  if (cachedTables) return cachedTables
  const enc = new TextEncoder()

  // SetItems.txt (existing parser) + strict header validation (the parser tolerates missing columns).
  const setItemsRaw = parseTable(enc.encode(RAW_SET_ITEMS))
  const siCol = headerIndex(setItemsRaw, 'SetItems.txt')
  for (const c of ['index', 'set', 'item', 'add func']) siCol(c)
  for (let i = 1; i <= 5; i++) {
    for (const s of ['a', 'b']) for (const p of ['aprop', 'apar', 'amin', 'amax']) siCol(`${p}${i}${s}`)
  }
  const setItems = parseSetItemsTable(setItemsRaw)

  // Sets.txt (existing parser) + strict header validation.
  const setsRaw = parseTable(enc.encode(RAW_SETS))
  const sCol = headerIndex(setsRaw, 'Sets.txt')
  const idxCol = sCol('index')
  for (let i = 2; i <= 5; i++) {
    for (const s of ['a', 'b']) for (const p of ['pcode', 'pparam', 'pmin', 'pmax']) sCol(`${p}${i}${s}`)
  }
  const fCodeCols: number[] = []
  for (let i = 1; i <= 8; i++) {
    for (const p of ['fparam', 'fmin', 'fmax']) sCol(`${p}${i}`)
    fCodeCols.push(sCol(`fcode${i}`))
  }
  const sets = parseSetsTable(setsRaw)

  // ITEMMODS_UpdateFullSetBoni applies FCode1..8 and stops at the first empty one (`break` on
  // nProperty < 0). parseSetsTable drops gaps, so count the leading non-empty FCode columns per row
  // from the raw table (same row filter as the parser: empty index / 'Expansion' separator skipped).
  const leadingFull = new Map<string, number>()
  for (const row of setsRaw.rows) {
    const index = row[idxCol] ?? ''
    if (!index || index === 'Expansion') continue
    let n = 0
    while (n < 8 && (row[fCodeCols[n]!] ?? '').trim() !== '') n++
    leadingFull.set(index, n)
  }

  const itemCountBySet = new Map<string, number>()
  for (const si of setItems.entries) {
    itemCountBySet.set(si.set, (itemCountBySet.get(si.set) ?? 0) + 1)
  }
  const setsByName = new Map<string, SetInfo>()
  for (const sd of sets.entries) {
    const partial: (SetBonusProp | null)[] = new Array<SetBonusProp | null>(8).fill(null)
    for (const p of sd.pCodes) {
      partial[(p.threshold - 2) * 2 + (p.slot === 'b' ? 1 : 0)] = p
    }
    const lead = leadingFull.get(sd.index)
    if (lead === undefined) throw new Error(`set-bonuses: Sets.txt row '${sd.index}' not found in raw table`)
    setsByName.set(sd.index, {
      name: sd.index,
      itemCount: itemCountBySet.get(sd.index) ?? 0,
      partial,
      full: sd.fCodes.slice(0, lead),
    })
  }

  // SetItemsTxt.nSetItems: position of the row among its set's rows in file order (ItemsTbls.cpp).
  const setItemsById = new Map<number, SetItemInfo>()
  const setItemIdsByCode = new Map<string, number[]>()
  const setItemIdByName = new Map<string, number>()
  const nextPos = new Map<string, number>()
  for (const si of setItems.entries) {
    if (!setsByName.has(si.set)) {
      throw new Error(`set-bonuses: SetItems.txt row '${si.index}' references unknown Sets.txt set '${si.set}'`)
    }
    const position = nextPos.get(si.set) ?? 0
    if (position > 5) throw new Error(`set-bonuses: set '${si.set}' has more than 6 SetItems.txt rows`)
    nextPos.set(si.set, position + 1)
    setItemsById.set(si.id, {
      id: si.id,
      name: si.index,
      set: si.set,
      code: si.item,
      position,
      addFunc: si.addFunc,
    })
    const codeList = setItemIdsByCode.get(si.item) ?? []
    codeList.push(si.id)
    setItemIdsByCode.set(si.item, codeList)
    setItemIdByName.set(si.index.toLowerCase(), si.id)
    setItemIdByName.set(si.index.trim().toLowerCase(), si.id)
    const tblEn = CANONICAL_ENG_TBL_DICT[si.index] ?? CANONICAL_ENG_TBL_DICT[si.index.trim()]
    if (tblEn) {
      const lowerEn = tblEn.trim().toLowerCase()
      if (!setItemIdByName.has(lowerEn)) {
        setItemIdByName.set(lowerEn, si.id)
      }
    }
  }

  // ItemStatCost.txt / Properties.txt (existing parsers).
  const iscRaw = parseTable(enc.encode(RAW_ITEM_STAT_COST))
  const iscCol = headerIndex(iscRaw, 'ItemStatCost.txt')
  for (const c of ['stat', 'id', 'valshift']) iscCol(c)
  const isc = parseItemStatCostTable(iscRaw)
  const propsRaw = parseTable(enc.encode(RAW_PROPERTIES))
  const pCol = headerIndex(propsRaw, 'Properties.txt')
  pCol('code')
  for (let i = 1; i <= 7; i++) for (const p of ['set', 'val', 'func', 'stat']) pCol(`${p}${i}`)
  const properties = parsePropertiesTable(propsRaw, isc)

  // Weapons.txt damage columns (Properties func 5/6 with a weapon trigger item). Throwability is
  // D2MOO `Items.cpp` `ITEMS_CheckIfThrowable` (#10759) -> `ITEMS_CheckItemTypeIfThrowable(wType[0])`:
  // the ItemTypes.txt `Throwable` flag of the weapon's primary Weapons.txt `type` (no Equiv walk).
  const itemTypesRaw = parseTable(enc.encode(RAW_ITEM_TYPES))
  const itCol = headerIndex(itemTypesRaw, 'ItemTypes.txt')
  const itCode = itCol('code')
  const itThrowable = itCol('throwable')
  const throwableByType = new Map<string, boolean>()
  for (const row of itemTypesRaw.rows) {
    const code = (row[itCode] ?? '').trim()
    if (!code) continue
    throwableByType.set(code, parseIntStrict(row[itThrowable] ?? '', `ItemTypes.txt Throwable (${code})`) !== 0)
  }
  const weaponsRaw = parseTable(enc.encode(RAW_WEAPONS))
  const wCol = headerIndex(weaponsRaw, 'Weapons.txt')
  const wc = {
    code: wCol('code'),
    type: wCol('type'),
    minDam: wCol('mindam'),
    maxDam: wCol('maxdam'),
    twoHandMinDam: wCol('2handmindam'),
    twoHandMaxDam: wCol('2handmaxdam'),
  }
  const weapons = new Map<string, WeaponDamageInfo>()
  for (const row of weaponsRaw.rows) {
    const code = (row[wc.code] ?? '').trim()
    if (!code) continue
    const type = (row[wc.type] ?? '').trim()
    const throwable = throwableByType.get(type)
    if (throwable === undefined) {
      throw new Error(`set-bonuses: Weapons.txt '${code}' has unknown ItemTypes.txt type '${type}'`)
    }
    weapons.set(code, {
      minDam: parseIntStrict(row[wc.minDam] ?? '', `Weapons.txt mindam (${code})`),
      maxDam: parseIntStrict(row[wc.maxDam] ?? '', `Weapons.txt maxdam (${code})`),
      twoHandMinDam: parseIntStrict(row[wc.twoHandMinDam] ?? '', `Weapons.txt 2handmindam (${code})`),
      twoHandMaxDam: parseIntStrict(row[wc.twoHandMaxDam] ?? '', `Weapons.txt 2handmaxdam (${code})`),
      throwable,
    })
  }

  // Skills (Properties func 11 / 22 params): embedded 1.13c Skills.txt-derived catalog.
  const skillIdsByName = new Map<string, number>()
  const skillIds = new Set<number>()
  for (const s of SKILLS_CATALOG) {
    skillIds.add(s.id)
    if (skillIdsByName.has(s.name)) throw new Error(`set-bonuses: duplicate skill name '${s.name}' in catalog`)
    skillIdsByName.set(s.name, s.id)
  }

  // States (Properties func 24 `state` params): embedded 1.13c States.txt-derived catalog.
  const stateIdsByName = new Map<string, number>()
  const stateIds = new Set<number>()
  for (const st of STATES_TXT_COLOR_ROWS) {
    stateIds.add(st.id)
    stateIdsByName.set(st.state, st.id)
  }

  cachedTables = {
    setItemsById,
    setItemIdsByCode,
    setItemIdByName,
    setsByName,
    properties,
    isc,
    weapons,
    skillIdsByName,
    skillIds,
    stateIdsByName,
    stateIds,
    stats: {
      mindamage: requireStat(isc, 'mindamage'),
      secondaryMindamage: requireStat(isc, 'secondary_mindamage'),
      throwMindamage: requireStat(isc, 'item_throw_mindamage'),
      maxdamage: requireStat(isc, 'maxdamage'),
      secondaryMaxdamage: requireStat(isc, 'secondary_maxdamage'),
      throwMaxdamage: requireStat(isc, 'item_throw_maxdamage'),
      minDamagePercent: requireStat(isc, 'item_mindamage_percent'),
      maxDamagePercent: requireStat(isc, 'item_maxdamage_percent'),
      poisonMaxDam: requireStat(isc, 'poisonmaxdam'),
      poisonCount: requireStat(isc, 'poison_count'),
    },
  }
  return cachedTables
}

/** Number of set bits (D2MOO `dword_6FDD14A8` popcount table). */
function popcount(mask: number): number {
  let n = 0
  for (let m = mask; m !== 0; m &= m - 1) n++
  return n
}

/**
 * Whether item-specific set list `listIndex` (mask bit, STATE_ITEMSET(listIndex + 1)) of a set item
 * is enabled, per D2MOO `Items.cpp` `sub_6FDA4380(pItem, nSetItemMask)`:
 *  - add func 0: returns FALSE, no list is ever enabled (e.g. Civerb's Cudgel, Trang-Oul's Claws).
 *  - add func 1: for every set position `i != own`, list `i > own ? i - 1 : i` is enabled iff mask
 *    bit `i` is set (a specific partner item).
 *  - add func 2: `nBonuses = popcount(mask)` (mask includes the item itself); lists
 *    `0 .. nBonuses - 2` are enabled (list k needs k + 2 equipped pieces of the set).
 */
function isItemSetListEnabled(info: SetItemInfo, listIndex: number, mask: number): boolean {
  switch (info.addFunc) {
    case 0:
      return false
    case 1: {
      const partnerPos = listIndex >= info.position ? listIndex + 1 : listIndex
      return partnerPos <= 5 && (mask & (1 << partnerPos)) !== 0
    }
    case 2:
      return listIndex <= popcount(mask) - 2
    default:
      throw new Error(`set-bonuses: unsupported SetItems.txt add func ${info.addFunc} on '${info.name}'`)
  }
}

interface PropertyContext {
  readonly tables: SetBonusTables
  /** The set item that triggered ITEMS_UpdateSets (pItem of the property functions). */
  readonly trigger: SetItemInfo
  readonly out: ItemStat[]
}

/** ITEMMODS_AddPropertyToItemStatList: no stat for value 0; value is shifted by the stat's ValShift. */
function addPropertyStat(ctx: PropertyContext, stat: StatRef, param: number, value: number): number {
  if (!value) return 0
  ctx.out.push({ statId: stat.id, param, value: value << stat.valShift })
  if (stat.id === ctx.tables.stats.poisonMaxDam.id) {
    // D2MOO: `if (nStatId == STAT_POISONMAXDAM) STATLIST_AddStat(pStatList, STAT_POISON_COUNT, 1, 0)`.
    ctx.out.push({ statId: ctx.tables.stats.poisonCount.id, param: 0, value: 1 })
  }
  return value
}

/** Txt min/max for funcs that roll `min + rand(max - min + 1)` with the item seed (unknown to us). */
function fixedValue(prop: SetBonusProp, what: string): number {
  if (prop.min !== prop.max) {
    throw new Error(`set-bonuses: ${what} '${prop.code}' has a random range ${prop.min}..${prop.max} (item seed unknown)`)
  }
  return prop.min
}

/** Properties func 5 (min) / 6 (max) damage spread, per D2MOO `ITEMMODS_PropertyFunc05/06`. */
function addDamageSpread(ctx: PropertyContext, kind: 'min' | 'max', value: number): number {
  if (value <= 0) {
    throw new Error(`set-bonuses: non-positive ${kind} damage bonus ${value} is not supported`)
  }
  const s = ctx.tables.stats
  const weapon = ctx.tables.weapons.get(ctx.trigger.code)
  const one = kind === 'min' ? s.mindamage : s.maxdamage
  const two = kind === 'min' ? s.secondaryMindamage : s.secondaryMaxdamage
  const thr = kind === 'min' ? s.throwMindamage : s.throwMaxdamage
  if (!weapon) {
    // `!ITEMS_CheckItemTypeId(pItem, ITEMTYPE_WEAPON)`: all three stats (positive values never clamp).
    addPropertyStat(ctx, one, 0, value)
    addPropertyStat(ctx, two, 0, value)
    addPropertyStat(ctx, thr, 0, value)
    return value
  }
  const oneDam = kind === 'min' ? weapon.minDam : weapon.maxDam
  const twoDam = kind === 'min' ? weapon.twoHandMinDam : weapon.twoHandMaxDam
  if (oneDam !== 0 || twoDam === 0) addPropertyStat(ctx, one, 0, value)
  if (twoDam !== 0 || oneDam === 0) addPropertyStat(ctx, two, 0, value)
  if (weapon.throwable) addPropertyStat(ctx, thr, 0, value)
  return value
}

function resolveSkillParam(ctx: PropertyContext, prop: SetBonusProp): number {
  const par = prop.par
  if (typeof par === 'number') {
    if (!ctx.tables.skillIds.has(par)) throw new Error(`set-bonuses: unknown skill id ${par} in '${prop.code}'`)
    return par
  }
  if (typeof par === 'string') {
    const id = ctx.tables.skillIdsByName.get(par)
    if (id === undefined) throw new Error(`set-bonuses: unknown skill '${par}' in '${prop.code}'`)
    return id
  }
  throw new Error(`set-bonuses: property '${prop.code}' needs a skill param`)
}

function resolveStateParam(ctx: PropertyContext, prop: SetBonusProp): number {
  const par = prop.par
  if (typeof par === 'number') {
    if (!ctx.tables.stateIds.has(par)) throw new Error(`set-bonuses: unknown state id ${par} in '${prop.code}'`)
    return par
  }
  if (typeof par === 'string') {
    const id = ctx.tables.stateIdsByName.get(par)
    if (id === undefined) throw new Error(`set-bonuses: unknown state '${par}' in '${prop.code}'`)
    return id
  }
  throw new Error(`set-bonuses: property '${prop.code}' needs a state param`)
}

function numericParam(prop: SetBonusProp): number {
  if (prop.par === undefined) return 0
  if (typeof prop.par === 'number') return prop.par
  throw new Error(`set-bonuses: property '${prop.code}' has non-numeric param '${prop.par}'`)
}

/**
 * D2MOO `D2COMMON_11292_ItemAssignProperty`: run Properties.txt func1..7 in order (stop at the first
 * empty func); slot 0's result is passed as `nValue` to the following slots (func 3 reuses it).
 */
function applyProperty(ctx: PropertyContext, prop: SetBonusProp): void {
  const rec: PropertyRecord | undefined = ctx.tables.properties.getByCode(prop.code)
  if (!rec) throw new Error(`set-bonuses: Properties.txt has no code '${prop.code}'`)
  const slots: readonly [number, number, number, string][] = [
    [rec.func1, rec.set1, rec.val1, rec.stat1],
    [rec.func2, rec.set2, rec.val2, rec.stat2],
    [rec.func3, rec.set3, rec.val3, rec.stat3],
    [rec.func4, rec.set4, rec.val4, rec.stat4],
    [rec.func5, rec.set5, rec.val5, rec.stat5],
    [rec.func6, rec.set6, rec.val6, rec.stat6],
    [rec.func7, rec.set7, rec.val7, rec.stat7],
  ]
  let firstValue = 0
  for (let i = 0; i < slots.length; i++) {
    const [func, set, val, statName] = slots[i]!
    if (!func) break
    if (SET_BONUS_EXCLUDED_PROPERTY_FUNCS.has(func)) continue
    if (set !== 0) {
      throw new Error(`set-bonuses: Properties.txt '${prop.code}' slot ${i + 1} uses set=${set} (unsupported)`)
    }
    const stat = (): StatRef => {
      if (!statName) throw new Error(`set-bonuses: Properties.txt '${prop.code}' slot ${i + 1} has no stat`)
      return requireStat(ctx.tables.isc, statName)
    }
    let result = 0
    switch (func) {
      case 1: // ITEMMODS_PropertyFunc01: stat = min (+ seed roll if min != max), layer 0
      case 8: // ITEMMODS_PropertyFunc08: same assignment
        result = addPropertyStat(ctx, stat(), 0, fixedValue(prop, `func ${func}`))
        break
      case 3: // ITEMMODS_PropertyFunc03: reuse slot 0's value (e.g. res-all), else roll like func 1
        result = addPropertyStat(ctx, stat(), 0, firstValue || fixedValue(prop, 'func 3'))
        break
      case 5: // ITEMMODS_PropertyFunc05 (dmg-min)
        result = addDamageSpread(ctx, 'min', firstValue || fixedValue(prop, 'func 5'))
        break
      case 6: // ITEMMODS_PropertyFunc06 (dmg-max)
        result = addDamageSpread(ctx, 'max', firstValue || fixedValue(prop, 'func 6'))
        break
      case 7: {
        // ITEMMODS_PropertyFunc07 (dmg%): both % stats unless a weapon trigger makes the bonus
        // non-positive (then it degrades to func 6 with 1); only positive bonuses are supported.
        const v = firstValue || fixedValue(prop, 'func 7')
        if (v <= 0) throw new Error(`set-bonuses: non-positive dmg% bonus ${v} is not supported`)
        addPropertyStat(ctx, ctx.tables.stats.minDamagePercent, 0, v)
        addPropertyStat(ctx, ctx.tables.stats.maxDamagePercent, 0, v)
        result = v
        break
      }
      case 11: {
        // ITEMMODS_PropertyFunc11: layer = (level & 63) + (skill << 6), value = chance (min, <= 0 -> 5).
        const skill = resolveSkillParam(ctx, prop)
        const chance = prop.min > 0 ? prop.min : 5
        const level = prop.max
        if (level <= 0) {
          throw new Error(`set-bonuses: '${prop.code}' level ${level} needs item-level scaling (unsupported)`)
        }
        result = addPropertyStat(ctx, stat(), (level & 63) + (skill << 6), chance)
        break
      }
      case 15: // ITEMMODS_PropertyFunc15: stat = min (mindamage -> func 5 spread)
        if (statName === 'mindamage') addDamageSpread(ctx, 'min', prop.min)
        else addPropertyStat(ctx, stat(), 0, prop.min)
        result = prop.min
        break
      case 16: // ITEMMODS_PropertyFunc16: stat = max (maxdamage -> func 6 spread)
        if (statName === 'maxdamage') addDamageSpread(ctx, 'max', prop.max)
        else addPropertyStat(ctx, stat(), 0, prop.max)
        result = prop.max
        break
      case 17: {
        // ITEMMODS_PropertyFunc17: value = param (nLayer), or min when the param is 0.
        const v = numericParam(prop) || fixedValue(prop, 'func 17')
        if (!v) break
        if (statName === 'maxdamage') addDamageSpread(ctx, 'max', v)
        else addPropertyStat(ctx, stat(), 0, v)
        result = v
        break
      }
      case 21: // ITEMMODS_PropertyFunc21: layer = Properties `val` (class id), value = min
        result = addPropertyStat(ctx, stat(), val, fixedValue(prop, 'func 21'))
        break
      case 22: // ITEMMODS_PropertyFunc22: layer = param (skill id), value = min
        result = addPropertyStat(ctx, stat(), resolveSkillParam(ctx, prop), fixedValue(prop, 'func 22'))
        break
      case 24: // ITEMMODS_PropertyFunc24: layer = param (state id), value = min (+ seed roll if min != max)
        result = addPropertyStat(ctx, stat(), resolveStateParam(ctx, prop), fixedValue(prop, 'func 24'))
        break
      default:
        throw new Error(`set-bonuses: Properties.txt func ${func} ('${prop.code}') is not supported`)
    }
    if (i === 0) firstValue = result
  }
}

/** Body locations that give stats / count for sets: 1..10 (BODYLOC_HEAD..BODYLOC_GLOVES), rule 23. */
const MIN_STAT_BODYLOC = 1
const MAX_STAT_BODYLOC = 10

/**
 * Resolves a SetItems.txt id from an item's `name` or unique base `code` when `setItemId` is not
 * populated on a synthetic / wire item.
 */
export function resolveSetItemIdByCodeOrName(item: { readonly code?: string; readonly name?: string }): number | undefined {
  const tables = loadTables()
  if (item.name) {
    const byName =
      tables.setItemIdByName.get(item.name.toLowerCase()) ??
      tables.setItemIdByName.get(item.name.trim().toLowerCase())
    if (byName !== undefined) return byName
  }
  if (item.code) {
    const byCode = tables.setItemIdsByCode.get(item.code) ?? tables.setItemIdsByCode.get(item.code.trim())
    if (byCode && byCode.length === 1) return byCode[0]
  }
  return undefined
}

/**
 * Returns all set-bonus stats (internal ValShift units) granted by `activeEquipped`.
 *
 * @param activeEquipped The unit's equipped items. Only items at body locations 1..10 count (rule 23:
 *   the weapon-switch slots 11/12 never give stats, regardless of `self.weaponSet`). Items that are
 *   not quality SET, have no `setItemId`, or are broken are ignored (they neither count nor
 *   contribute). Unidentified set items still count toward their set (ITEMS_GetSetItemsMask checks
 *   only IFLAG_NOEQUIP / IFLAG_BROKEN); their own lists are never sent while unidentified.
 * @returns Item-specific enabled lists (per item, ascending list index) followed by the Sets.txt
 *   partial/full bonuses (once per set). Values are never merged; the engine sums them.
 * @throws If a set item references an unknown SetItems.txt row, a table/column/stat is missing, or a
 *   property needs data this module cannot derive (no guessing).
 */
export function computeSetBonusStats(activeEquipped: readonly ItemData[]): ItemStat[] {
  const tables = loadTables()
  const seenIds = new Set<number>()
  const counted: { item: ItemData; info: SetItemInfo }[] = []
  for (const item of activeEquipped) {
    if (seenIds.has(item.id)) throw new Error(`set-bonuses: item ${item.id} passed twice`)
    seenIds.add(item.id)
    const bodyLoc = item.bodyLoc || item.equippedSlot || 0
    if (bodyLoc < MIN_STAT_BODYLOC || bodyLoc > MAX_STAT_BODYLOC) continue
    if (item.quality !== ITEM_QUALITY_SET || item.setItemId === undefined || item.broken) continue
    const info = tables.setItemsById.get(item.setItemId)
    if (!info) throw new Error(`set-bonuses: item ${item.id} has unknown SetItems.txt id ${item.setItemId}`)
    counted.push({ item, info })
  }

  // ITEMS_GetSetItemsMask per set.
  const maskBySet = new Map<string, number>()
  for (const { info } of counted) {
    maskBySet.set(info.set, (maskBySet.get(info.set) ?? 0) | (1 << info.position))
  }

  const out: ItemStat[] = []

  // 1. Item-specific lists (Items.cpp sub_6FDA4380).
  for (const { item, info } of counted) {
    const mask = maskBySet.get(info.set)!
    for (const list of item.setBonusStats ?? []) {
      if (!Number.isInteger(list.index) || list.index < 0 || list.index > 4) {
        throw new Error(`set-bonuses: item ${item.id} has invalid set list index ${list.index}`)
      }
      if (isItemSetListEnabled(info, list.index, mask)) out.push(...list.stats)
    }
  }

  // 2. Sets.txt partial/full bonuses (ItemMods.cpp ITEMMODS_UpdateFullSetBoni), once per set.
  for (const [setName, mask] of maskBySet) {
    const set = tables.setsByName.get(setName)!
    const count = popcount(mask)
    // pItem of the property functions: the member that completes the set when pieces are equipped
    // in SetItems.txt order (only matters for func 5/6 damage spreads; see handoff caveats).
    let trigger: SetItemInfo | undefined
    for (const { info } of counted) {
      if (info.set === setName && (!trigger || info.position > trigger.position)) trigger = info
    }
    const ctx: PropertyContext = { tables, trigger: trigger!, out }
    // `if (nItems >= nSetItems - 1) nItems = nSetItems - 1; for (i < 2 * (nItems - 1)) pBoni2[i]`.
    const partialCount = Math.min(count, set.itemCount - 1)
    for (let i = 0; i < 2 * (partialCount - 1); i++) {
      const prop = set.partial[i]
      if (prop) applyProperty(ctx, prop)
    }
    // Full set (FCode1..8): the decomp reuses the capped counter here, which would make full-set
    // bonuses unreachable and contradicts 1.13c; the uncapped equipped count is used instead.
    if (count >= set.itemCount) {
      for (const prop of set.full) applyProperty(ctx, prop)
    }
  }
  return out
}

function collectCountedSetItems(
  activeEquipped: readonly ItemData[],
  allowFallbackResolve = true,
): {
  readonly tables: SetBonusTables
  readonly counted: { item: ItemData; info: SetItemInfo }[]
  readonly maskBySet: Map<string, number>
} {
  const tables = loadTables()
  const seenIds = new Set<number>()
  const counted: { item: ItemData; info: SetItemInfo }[] = []
  for (const item of activeEquipped) {
    if (seenIds.has(item.id)) continue
    seenIds.add(item.id)
    const bodyLoc = item.bodyLoc || item.equippedSlot || 0
    if (bodyLoc < MIN_STAT_BODYLOC || bodyLoc > MAX_STAT_BODYLOC) continue
    if (item.quality !== ITEM_QUALITY_SET || item.broken) continue
    const setItemId = item.setItemId ?? (allowFallbackResolve ? resolveSetItemIdByCodeOrName(item) : undefined)
    if (setItemId === undefined) continue
    const info = tables.setItemsById.get(setItemId)
    if (!info) continue
    counted.push({ item, info })
  }
  const maskBySet = new Map<string, number>()
  for (const { info } of counted) {
    maskBySet.set(info.set, (maskBySet.get(info.set) ?? 0) | (1 << info.position))
  }
  return { tables, counted, maskBySet }
}

/**
 * Returns the enabled item-specific set bonus stats (`item.setBonusStats` gated by `addFunc` and
 * equipped set mask) for a single equipped item (`Items.cpp` `sub_6FDA4380`).
 *
 * Attached to the item's own stat list in `buildEquipmentItem` so item-local ops (`op 13` `%AC`/`%ED`,
 * `op 4` `ac/lvl`/`dmg/lvl`, `op 5` `ac%/lvl`/`dmg%/lvl`) evaluate with `owner: 'item'`.
 */
export function computeItemSetBonusStats(item: ItemData, activeEquipped: readonly ItemData[]): ItemStat[] {
  if (item.quality !== ITEM_QUALITY_SET || item.broken || !item.setBonusStats || item.setBonusStats.length === 0) {
    return []
  }
  const { counted, maskBySet } = collectCountedSetItems(activeEquipped, true)
  const entry = counted.find(c => c.item.id === item.id)
  if (!entry) return []
  const mask = maskBySet.get(entry.info.set) ?? 0
  const out: ItemStat[] = []
  for (const list of item.setBonusStats) {
    if (!Number.isInteger(list.index) || list.index < 0 || list.index > 4) continue
    if (isItemSetListEnabled(entry.info, list.index, mask)) out.push(...list.stats)
  }
  return out
}

/**
 * Returns ONLY the `Sets.txt` partial and full set bonus stats (`ITEMMODS_UpdateFullSetBoni`),
 * excluding per-item `item.setBonusStats` (which are attached to each item's own stat list).
 */
export function computeFullSetBonusStats(activeEquipped: readonly ItemData[]): ItemStat[] {
  const { tables, counted, maskBySet } = collectCountedSetItems(activeEquipped, true)
  const out: ItemStat[] = []
  for (const [setName, mask] of maskBySet) {
    const set = tables.setsByName.get(setName)
    if (!set) continue
    const count = popcount(mask)
    let trigger: SetItemInfo | undefined
    for (const { info } of counted) {
      if (info.set === setName && (!trigger || info.position > trigger.position)) trigger = info
    }
    if (!trigger) continue
    const ctx: PropertyContext = { tables, trigger, out }
    const partialCount = Math.min(count, set.itemCount - 1)
    for (let i = 0; i < 2 * (partialCount - 1); i++) {
      const prop = set.partial[i]
      if (prop) applyProperty(ctx, prop)
    }
    if (count >= set.itemCount) {
      for (const prop of set.full) applyProperty(ctx, prop)
    }
  }
  return out
}
