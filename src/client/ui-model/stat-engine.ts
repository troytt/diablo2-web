import {
  computeFullSetBonusStats,
  computeItemSetBonusStats,
  computeSetBonusStats,
} from './set-bonuses.ts'
import { resolveOnlineItemReqLevel } from '../../common/items/item-bridge.ts'
import {
  calculateBlessedAimStats,
  calculateConcentrationStats,
  calculateDefianceStats,
  calculateFanaticismStats,
  calculateHolyFireStats,
  calculateHolyFreezeStats,
  calculateHolyShockStats,
  calculateMightStats,
  calculateResistColdStats,
  calculateResistFireStats,
  calculateResistLightningStats,
  calculateSalvationStats,
  calculateVigorStats,
} from '../../common/skills/paladin-auras.ts'
/**
 * Character-sheet stat engine (`src/client/ui-model/stat-engine.ts`) — Diablo II v1.13c.
 *
 * One data-driven implementation of the D2Common stat-list machinery used by every character-sheet
 * consumer (player sheet F1–F5, combat F6/F7 via `combat-stats.ts`, merc panel F8 via `merc-stats.ts`).
 *
 * Ground truth (PROJECT.md rules 9–24):
 * - Op engine: D2MOO `D2Common/src/D2StatList.cpp` `sub_6FDB5830` (D2Common.0x6FDB5830), lines 169–436:
 *   accumulate `base + Σ attached lists` (L181–192), capture `nPreviousOpStatValue` BEFORE the op loop
 *   (L199), then run every op whose `op statN` targets the stat, in ItemStatCost row order.
 * - List attachment: `D2COMMON_10475_PostStatToStatList` (D2StatList.cpp L1059–1150) propagates an
 *   attached list's FullStats (item lists after their own item-local ops) into the unit.
 * - Items: only body locs 1..10 give stats; 11/12 (swap set) never do (rules 23–24, D2Game
 *   `D2GAME_ITEMS_UpdateInventoryItems` loop `i < 11`). Broken items give nothing (`ITEMS_CanBeEquipped`
 *   #10839, Items.cpp:4493). Unidentified items carry no magic lists on the wire (Items.cpp:7216
 *   `bServer || IFLAG_IDENTIFIED`); their base defense/damage still apply.
 * - Sockets: jewels contribute their own stat list; gems/runes contribute Gems.txt mods of the property
 *   set selected by the HOST's `gemapplytype` (`ITEMS_GetGemApplyType` #10820, Items.cpp:3236;
 *   ItemMods.cpp PROPMODE_GEM/PROPMODE_RUNE `pProperties[nPropSet]`).
 * - Charms: inventory grid only, ItemTypes ancestry `char` (`ITEMS_IsCharmUsable` @ `0x6fd77090` /
 *   `ITEMS_CheckRequirements` @ `0x6fd76db0` / `ITEMS_GetRequiredLevel` @ `0x6fd76190`), player only,
 *   requiring `identified !== false`, `!broken`, `wearerLevel >= reqLevel`, and unique charm deduplication.
 * - States: every 0xA8 state stat list on the unit (`StatList.getStateStats`, deduped by state id).
 * - Passives (rule 10): the passive state's server list if present, else Skills.txt passivestat/passivecalc
 *   at the effective level (`SKILLS_RefreshSkill` #10940, D2Skills.cpp L512–600), dropped while the skill's
 *   aurastate is on the unit.
 * - Set bonuses (rule 18): excluded until W-D's `computeSetBonusStats` lands (never `item.setBonusStats`).
 *
 * All values are INTERNAL units (ItemStatCost ValShift kept); display = `>> ValShift`.
 */

import type { CharClassId, ItemData, ItemStat } from '../../netproto/index.ts'
import { RAW_ITEM_STAT_COST, RAW_PROPERTIES } from '../../common/data/canonical-vendor-data.ts'
import {
  RAW_ARMOR,
  RAW_DIFFICULTY_LEVELS,
  RAW_ITEM_TYPES,
  RAW_MISC,
  RAW_WEAPONS,
} from '../../common/data/canonical-drop-data.ts'
import { CANONICAL_GEMS_TABLE, type Gem, type GemModifier } from '../../common/items/gems.ts'
import { isA, parseItemTypesTable, type ItemTypeTable } from '../../common/items/item-types.ts'
import {
  parseItemStatCostTable,
  parsePropertiesTable,
  resolveProperty,
  type ItemStatCostRecord,
  type ItemStatCostTable,
  type PropertiesTable,
} from '../../common/items/properties.ts'
import { CANONICAL_CHARSTATS, CHARACTER_CLASS_CODES, type CharacterClassCode } from '../../common/units/classes.ts'
import { parseTable, type D2Table } from '../../common/world/acts.ts'
import type { ClientItemContainers } from '../world/inventory.ts'
import type { StatList } from '../world/stat-list.ts'
import {
  SKILLS_TXT_ROWS,
  STATES_TXT_COLOR_ROWS,
  type SkillsTxtRow,
  type StatesTxtColorFlag,
  type StatesTxtColorRow,
} from './stat-engine/generated-states-skills.ts'

export type { SkillsTxtRow, StatesTxtColorFlag, StatesTxtColorRow }

/** Error raised by every throwing accessor (missing table row/column, unresolved reference). */
export class StatEngineDataError extends Error {
  constructor(message: string) {
    super(`stat-engine: ${message}`)
    this.name = 'StatEngineDataError'
  }
}

// ============================================================================================
// (a) Throwing table accessors (rule 20). Parsed once from the repo's embedded 1.13c tables.
// ============================================================================================

function lazy<T>(build: () => T): () => T {
  let value: T | undefined
  let built = false
  return () => {
    if (!built) {
      value = build()
      built = true
    }
    return value as T
  }
}

const textEncoder = new TextEncoder()
function parseEmbedded(tsv: string): D2Table {
  return parseTable(textEncoder.encode(tsv))
}

function requireColumn(table: D2Table, column: string, tableName: string): number {
  const index = table.header.indexOf(column)
  if (index === -1) throw new StatEngineDataError(`${tableName}: missing column '${column}'`)
  return index
}

/** One parsed ItemStatCost.txt row with the op columns resolved to stat ids. */
export interface IscRow {
  readonly id: number
  readonly name: string
  readonly op: number
  readonly opParam: number
  /** Stat id of `op base` (e.g. 12 `level`), or null when blank. */
  readonly opBase: number | null
  /** Stat ids of `op stat1..3` (blank cells omitted). */
  readonly opStats: readonly number[]
  readonly valShift: number
  /** ISC `damagerelated` column. */
  readonly damageRelated: boolean
}

/** One op that targets a stat (inverse of `op stat1..3`), as D2Common stores `pOpStatData`. */
export interface IscOpSource {
  /** The stat carrying the op (e.g. 76 for maxhp, 3 vitality for maxhp). */
  readonly source: number
  readonly op: number
  readonly opParam: number
  readonly opBase: number | null
}

interface IscIndex {
  readonly table: ItemStatCostTable
  readonly byId: ReadonlyMap<number, IscRow>
  readonly byName: ReadonlyMap<string, IscRow>
  /** target stat id -> ops targeting it, sorted by source stat id (ItemStatCost row order). */
  readonly opSourcesByTarget: ReadonlyMap<number, readonly IscOpSource[]>
}

const ISC_REQUIRED_COLUMNS = ['Stat', 'ID', 'op', 'op param', 'op base', 'op stat1', 'op stat2', 'op stat3', 'ValShift', 'damagerelated']

const getIscIndex = lazy((): IscIndex => {
  const raw = parseEmbedded(RAW_ITEM_STAT_COST)
  for (const c of ISC_REQUIRED_COLUMNS) requireColumn(raw, c, 'ItemStatCost.txt')
  const damageRelatedCol = requireColumn(raw, 'damagerelated', 'ItemStatCost.txt')
  const statCol = requireColumn(raw, 'Stat', 'ItemStatCost.txt')
  const damageRelatedByName = new Map<string, boolean>()
  for (const row of raw.rows) {
    const name = (row[statCol] ?? '').trim()
    if (name !== '') damageRelatedByName.set(name, (row[damageRelatedCol] ?? '').trim() === '1')
  }
  const table = parseItemStatCostTable(raw)
  const records: readonly ItemStatCostRecord[] = table.records
  if (records.length === 0) throw new StatEngineDataError('ItemStatCost.txt: parser returned no records')
  const nameToId = new Map<string, number>()
  for (const r of records) nameToId.set(r.stat, r.id)
  const resolveName = (name: string, context: string): number | null => {
    const trimmed = name.trim()
    if (trimmed === '') return null
    const id = nameToId.get(trimmed)
    if (id === undefined) throw new StatEngineDataError(`ItemStatCost.txt: unresolved '${trimmed}' (${context})`)
    return id
  }
  const byId = new Map<number, IscRow>()
  const byName = new Map<string, IscRow>()
  for (const r of records) {
    if (!Number.isInteger(r.id) || r.id < 0) throw new StatEngineDataError(`ItemStatCost.txt: bad ID for '${r.stat}'`)
    const opStats: number[] = []
    for (const s of [r.opStat1, r.opStat2, r.opStat3]) {
      const id = resolveName(s, `${r.stat}.op stat`)
      if (id !== null) opStats.push(id)
    }
    const damageRelated = damageRelatedByName.get(r.stat)
    if (damageRelated === undefined) throw new StatEngineDataError(`ItemStatCost.txt: no damagerelated cell for '${r.stat}'`)
    const row: IscRow = {
      id: r.id,
      name: r.stat,
      op: r.op,
      opParam: r.opParam,
      opBase: resolveName(r.opBase, `${r.stat}.op base`),
      opStats,
      valShift: r.valShift,
      damageRelated,
    }
    byId.set(row.id, row)
    byName.set(row.name, row)
  }
  const opSourcesByTarget = new Map<number, IscOpSource[]>()
  const sortedIds = [...byId.keys()].sort((a, b) => a - b)
  for (const id of sortedIds) {
    const row = byId.get(id) as IscRow
    if (row.op === 0) continue
    for (const target of row.opStats) {
      const list = opSourcesByTarget.get(target) ?? []
      list.push({ source: row.id, op: row.op, opParam: row.opParam, opBase: row.opBase })
      opSourcesByTarget.set(target, list)
    }
  }
  return { table, byId, byName, opSourcesByTarget }
})

/** ItemStatCost.txt row by id. Throws if missing. */
export function getIscRow(statId: number): IscRow {
  const row = getIscIndex().byId.get(statId)
  if (!row) throw new StatEngineDataError(`ItemStatCost.txt: no row for stat ${statId}`)
  return row
}

/** Ops that target `statId` (D2Common `pOpStatData` of the target), in ItemStatCost row order. */
export function getIscOpSources(statId: number): readonly IscOpSource[] {
  return getIscIndex().opSourcesByTarget.get(statId) ?? []
}

/** The parsed ItemStatCost table (existing `parseItemStatCostTable`). */
export function getItemStatCostTable(): ItemStatCostTable {
  return getIscIndex().table
}

const getPropertiesTable = lazy((): PropertiesTable => parsePropertiesTable(parseEmbedded(RAW_PROPERTIES)))

/** A raw row of Weapons.txt / Armor.txt / Misc.txt with throwing column access. */
export class BaseItemRow {
  constructor(
    readonly tableName: 'Weapons.txt' | 'Armor.txt' | 'Misc.txt',
    private readonly header: readonly string[],
    private readonly cells: readonly string[],
  ) {}

  /** Trimmed cell text. Throws if the column does not exist. */
  text(column: string): string {
    const index = this.header.indexOf(column)
    if (index === -1) throw new StatEngineDataError(`${this.tableName}: missing column '${column}'`)
    return (this.cells[index] ?? '').trim()
  }

  /** Integer cell. Throws if the column is missing, blank or not an integer. */
  int(column: string): number {
    const text = this.text(column)
    const n = Number(text)
    if (text === '' || !Number.isInteger(n)) {
      throw new StatEngineDataError(`${this.tableName} ${this.text('code')}: '${column}' is not an integer ('${text}')`)
    }
    return n
  }

  /**
   * Integer cell where a blank cell is meaningful (the D2 txt loader zero-initialises it, e.g.
   * `2handmindam` on one-handed weapons). Returns null for blank; throws for a missing column or junk.
   */
  intOrBlank(column: string): number | null {
    const text = this.text(column)
    if (text === '') return null
    const n = Number(text)
    if (!Number.isInteger(n)) throw new StatEngineDataError(`${this.tableName} ${this.text('code')}: '${column}'='${text}'`)
    return n
  }
}

interface BaseTableIndex {
  readonly byCode: ReadonlyMap<string, BaseItemRow>
}

function indexBaseTable(tsv: string, tableName: BaseItemRow['tableName']): BaseTableIndex {
  const table = parseEmbedded(tsv)
  const codeCol = requireColumn(table, 'code', tableName)
  const byCode = new Map<string, BaseItemRow>()
  for (const cells of table.rows) {
    const code = (cells[codeCol] ?? '').trim()
    if (code === '') continue
    byCode.set(code, new BaseItemRow(tableName, table.header, cells))
  }
  return { byCode }
}

const getWeaponsIndex = lazy(() => indexBaseTable(RAW_WEAPONS, 'Weapons.txt'))
const getArmorIndex = lazy(() => indexBaseTable(RAW_ARMOR, 'Armor.txt'))
const getMiscIndex = lazy(() => indexBaseTable(RAW_MISC, 'Misc.txt'))

/** Armor.txt row by item code. Throws if missing. */
export function getArmorRow(code: string): BaseItemRow {
  const row = getArmorIndex().byCode.get(code)
  if (!row) throw new StatEngineDataError(`Armor.txt: no row '${code}'`)
  return row
}

export type ItemBaseTable = 'weapons' | 'armor' | 'misc'

/** The Items.txt-family row of an item code (exactly one of Weapons/Armor/Misc). Throws if none. */
export function getItemBaseRow(code: string): { readonly table: ItemBaseTable; readonly row: BaseItemRow } {
  const weapon = getWeaponsIndex().byCode.get(code)
  if (weapon) return { table: 'weapons', row: weapon }
  const armor = getArmorIndex().byCode.get(code)
  if (armor) return { table: 'armor', row: armor }
  const misc = getMiscIndex().byCode.get(code)
  if (misc) return { table: 'misc', row: misc }
  throw new StatEngineDataError(`no Weapons/Armor/Misc row for item code '${code}'`)
}

interface ItemTypesIndex {
  readonly table: ItemTypeTable
  /** ItemTypes.txt row index (= the engine's item type id) by code. */
  readonly indexByCode: ReadonlyMap<string, number>
}

const getItemTypesIndex = lazy((): ItemTypesIndex => {
  const raw = parseEmbedded(RAW_ITEM_TYPES)
  const nameCol = requireColumn(raw, 'ItemType', 'ItemTypes.txt')
  const codeCol = requireColumn(raw, 'Code', 'ItemTypes.txt')
  const indexByCode = new Map<string, number>()
  // The D2 txt compiler drops the "Expansion" separator row, so engine type ids after it are one less
  // than the raw row index (D2MOO D2Items.h D2C_ItemTypes: ITEMTYPE_JEWEL = 58, ITEMTYPE_HAND_TO_HAND = 67).
  let typeId = 0
  for (const cells of raw.rows) {
    if ((cells[nameCol] ?? '').trim() === 'Expansion') continue
    const code = (cells[codeCol] ?? '').trim()
    if (code !== '' && !indexByCode.has(code)) indexByCode.set(code, typeId)
    typeId++
  }
  return { table: parseItemTypesTable(raw), indexByCode }
})

/** ItemTypes.txt row index of a type code (D2 item type id, e.g. the param of mastery passives). */
export function getItemTypeIndex(typeCode: string): number {
  const index = getItemTypesIndex().indexByCode.get(typeCode)
  if (index === undefined) throw new StatEngineDataError(`ItemTypes.txt: no type '${typeCode}'`)
  return index
}

/** ItemTypes.txt Equiv1/Equiv2 ancestry test (existing `isA`). Throws on unknown codes. */
export function itemTypeIsA(typeCode: string, ancestorCode: string): boolean {
  const { table } = getItemTypesIndex()
  if (!table.byCode.has(typeCode)) throw new StatEngineDataError(`ItemTypes.txt: no type '${typeCode}'`)
  if (!table.byCode.has(ancestorCode)) throw new StatEngineDataError(`ItemTypes.txt: no type '${ancestorCode}'`)
  return isA(typeCode, ancestorCode, table)
}

/** True when the item code's `type` or `type2` descends from `ancestorCode` (D2Common ITEMS_CheckItemTypeId). */
export function itemCodeIsA(itemCode: string, ancestorCode: string): boolean {
  const { row } = getItemBaseRow(itemCode)
  const type1 = row.text('type')
  if (type1 === '') throw new StatEngineDataError(`${row.tableName} ${itemCode}: blank 'type'`)
  if (itemTypeIsA(type1, ancestorCode)) return true
  const type2 = row.text('type2')
  return type2 !== '' && itemTypeIsA(type2, ancestorCode)
}

export type Difficulty = 0 | 1 | 2

const DIFFICULTY_ROW_NAMES = ['Normal', 'Nightmare', 'Hell'] as const

const getDifficultyRows = lazy((): readonly { readonly name: string; readonly resistPenalty: number }[] => {
  const table = parseEmbedded(RAW_DIFFICULTY_LEVELS)
  const nameCol = requireColumn(table, 'Name', 'DifficultyLevels.txt')
  const penaltyCol = requireColumn(table, 'ResistPenalty', 'DifficultyLevels.txt')
  const rows = table.rows.map(cells => {
    const name = (cells[nameCol] ?? '').trim()
    const text = (cells[penaltyCol] ?? '').trim()
    const resistPenalty = Number(text)
    if (text === '' || !Number.isInteger(resistPenalty)) {
      throw new StatEngineDataError(`DifficultyLevels.txt: ResistPenalty '${text}' for '${name}'`)
    }
    return { name, resistPenalty }
  })
  DIFFICULTY_ROW_NAMES.forEach((expected, index) => {
    if (rows[index]?.name !== expected) {
      throw new StatEngineDataError(`DifficultyLevels.txt: row ${index} is '${rows[index]?.name}', expected '${expected}'`)
    }
  })
  return rows
})

/** DifficultyLevels.txt row (row index = difficulty 0/1/2). Throws if missing. */
export function getDifficultyLevelRow(difficulty: Difficulty): { readonly name: string; readonly resistPenalty: number } {
  const row = getDifficultyRows()[difficulty]
  if (!row) throw new StatEngineDataError(`DifficultyLevels.txt: no row for difficulty ${difficulty}`)
  return row
}

/** (g) DifficultyLevels.txt `ResistPenalty` (1.13c: 0 / −40 / −100). Applies to players and mercs. */
export function resistPenalty(difficulty: Difficulty): number {
  return getDifficultyLevelRow(difficulty).resistPenalty
}

/** CharStats.txt per-class values the stat engine needs, in the engine's raw units. */
export interface CharStatsRow {
  readonly classCode: CharacterClassCode
  /** CharStats `LifePerVitality` (fourths, e.g. Amazon 12). */
  readonly lifePerVitality: number
  /** CharStats `StaminaPerVitality` (fourths). */
  readonly staminaPerVitality: number
  /** CharStats `ManaPerMagic` (fourths). */
  readonly manaPerMagic: number
  /** CharStats `ToHitFactor`. */
  readonly toHitFactor: number
}

function fourths(value: number, what: string): number {
  const raw = value * 4
  if (!Number.isInteger(raw)) throw new StatEngineDataError(`CharStats: ${what}=${value} is not a multiple of 1/4`)
  return raw
}

/** CharStats.txt row for a class (repo canonical `CANONICAL_CHARSTATS`, 1.13c). Throws if missing. */
export function getCharStatsRow(classCode: CharacterClassCode): CharStatsRow {
  const stats = CANONICAL_CHARSTATS[classCode]
  if (!stats) throw new StatEngineDataError(`CharStats.txt: no class '${classCode}'`)
  return {
    classCode,
    lifePerVitality: fourths(stats.perStatPoint.lifePerVitality, 'LifePerVitality'),
    staminaPerVitality: fourths(stats.perStatPoint.staminaPerVitality, 'StaminaPerVitality'),
    manaPerMagic: fourths(stats.perStatPoint.manaPerEnergy, 'ManaPerMagic'),
    toHitFactor: stats.toHitFactor,
  }
}

/** D2 class id (CharStats row index 0..6) → class code. Throws if out of range. */
export function classCodeFromId(classId: CharClassId): CharacterClassCode {
  const code = CHARACTER_CLASS_CODES[classId]
  if (!code) throw new StatEngineDataError(`CharStats.txt: no class id ${classId}`)
  return code
}

const getSkillsIndex = lazy(() => {
  const byId = new Map<number, SkillsTxtRow>()
  const byName = new Map<string, SkillsTxtRow>()
  const passiveStateIds = new Set<number>()
  for (const row of SKILLS_TXT_ROWS) {
    byId.set(row.id, row)
    byName.set(row.skill, row)
    if (row.passiveState !== null) passiveStateIds.add(row.passiveState)
  }
  return { byId, byName, passiveStateIds }
})

/** Skills.txt row (generated subset) by id. Throws if missing. */
export function getSkillsRow(skillId: number): SkillsTxtRow {
  const row = getSkillsIndex().byId.get(skillId)
  if (!row) throw new StatEngineDataError(`Skills.txt: no row for skill ${skillId}`)
  return row
}

/** Skills.txt row by `skill` key. Throws if missing. */
export function getSkillsRowByName(name: string): SkillsTxtRow {
  const row = getSkillsIndex().byName.get(name)
  if (!row) throw new StatEngineDataError(`Skills.txt: no row '${name}'`)
  return row
}

/** True when `stateId` is some skill's Skills.txt `passivestate`. */
export function isPassiveState(stateId: number): boolean {
  return getSkillsIndex().passiveStateIds.has(stateId)
}

const getStatesIndex = lazy(() => {
  const byId = new Map<number, StatesTxtColorRow>()
  const byName = new Map<string, StatesTxtColorRow>()
  for (const row of STATES_TXT_COLOR_ROWS) {
    byId.set(row.id, row)
    byName.set(row.state, row)
  }
  return { byId, byName }
})

/** States.txt row (generated colour subset) by id. Throws if missing. */
export function getStatesRow(stateId: number): StatesTxtColorRow {
  const row = getStatesIndex().byId.get(stateId)
  if (!row) throw new StatEngineDataError(`States.txt: no row for state ${stateId}`)
  return row
}

/** States.txt id by `state` key. Throws if missing. */
export function getStateIdByName(name: string): number {
  const row = getStatesIndex().byName.get(name)
  if (!row) throw new StatEngineDataError(`States.txt: no row '${name}'`)
  return row.id
}

/** Gems.txt row by item code (existing `CANONICAL_GEMS_TABLE`). Throws if missing. */
export function getGemRow(code: string): Gem {
  const gem = CANONICAL_GEMS_TABLE.byCode.get(code)
  if (!gem) throw new StatEngineDataError(`Gems.txt: no row '${code}'`)
  return gem
}

/** True when the item code is a Gems.txt row (gem or rune), i.e. socket mods come from Gems.txt. */
export function isGemsTxtItem(code: string): boolean {
  return CANONICAL_GEMS_TABLE.byCode.has(code)
}

// ============================================================================================
// (f) States.txt colour flags (rule 16)
// ============================================================================================

/** Union of the States.txt colour flags of the given active states. Throws on an unknown state id. */
export function stateColorFlags(activeStates: Iterable<number>): ReadonlySet<StatesTxtColorFlag> {
  const out = new Set<StatesTxtColorFlag>()
  for (const id of activeStates) {
    for (const flag of getStatesRow(id).flags) out.add(flag)
  }
  return out
}

/** True when any active state has the States.txt colour flag set. */
export function hasStateColorFlag(activeStates: Iterable<number>, flag: StatesTxtColorFlag): boolean {
  return stateColorFlags(activeStates).has(flag)
}

// ============================================================================================
// Stat-list helpers
// ============================================================================================

export function statKey(statId: number, param: number): string {
  return `${statId}:${param}`
}

/** A mutable flat stat list keyed by (stat, param), values in internal units. */
export class FlatStatList {
  private readonly values = new Map<string, ItemStat>()

  add(statId: number, param: number, value: number): void {
    const key = statKey(statId, param)
    const prev = this.values.get(key)
    this.values.set(key, { statId, param, value: (prev ? prev.value : 0) + value })
  }

  addAll(stats: readonly ItemStat[]): void {
    for (const s of stats) this.add(s.statId, s.param, s.value)
  }

  get(statId: number, param = 0): number {
    const entry = this.values.get(statKey(statId, param))
    return entry ? entry.value : 0
  }

  has(statId: number, param = 0): boolean {
    return this.values.has(statKey(statId, param))
  }

  entries(): ItemStat[] {
    return [...this.values.values()]
  }
}

// ============================================================================================
// (b) ISC op engine (rule 11) — sub_6FDB5830
// ============================================================================================

/** `ComputeStatPercentage` (D2StatList.cpp L155–166): `(int)(nValue * (nOpStatValue / 100.0))`. */
function statPercentage(value: number, opStatValue: number): number {
  if (opStatValue === 0) return 0
  return Math.trunc(value * (opStatValue / 100.0))
}

/** Owner of the list being evaluated (D2Common `pStatListEx->pOwner->dwUnitType`). */
export type StatOwnerKind = 'player' | 'monster' | 'item'

export interface OpEngineContext {
  readonly owner: StatOwnerKind
  /** Owner's own stats (`STATLIST_GetBaseStat` of the owner's list). */
  base(statId: number, param: number): number
  /** Attached lists (each one's FullStats), summed by `GetTotalStat` in sub_6FDB5830 L181–192. */
  readonly lists: readonly FlatStatList[]
  /** CharStats row (op 8/9; players only). */
  readonly charStats: CharStatsRow | null
  /**
   * Item owners only: the wearer's total `op base` stat (op 4/5 read `pStatListEx->pUnit` FullStats);
   * null when the item is not on a player/monster.
   */
  readonly wearerTotal: ((statId: number) => number) | null
}

/** Diagnostics for ops the client cannot evaluate (op 6/7 by-time: no day period on the client). */
export interface OpEngineDiagnostic {
  readonly target: number
  readonly source: number
  readonly op: number
}

/**
 * Evaluates the final value of stats on one list owner exactly like D2Common sub_6FDB5830.
 * Results are memoized; the engine is immutable once built.
 */
export class StatOpEngine {
  private readonly memo = new Map<string, number>()
  readonly diagnostics: OpEngineDiagnostic[] = []

  constructor(private readonly ctx: OpEngineContext) {}

  /** Sum of the attached lists only (no base, no ops). */
  listSum(statId: number, param = 0): number {
    let sum = 0
    for (const list of this.ctx.lists) sum += (list.get(statId, param) ?? 0)
    return sum
  }

  /** Final value (internal units) of `(statId, param)`. */
  value(statId: number, param = 0): number {
    const key = statKey(statId, param)
    const cached = this.memo.get(key)
    if (cached !== undefined) return cached
    const result = this.evaluate(statId, param)
    this.memo.set(key, result)
    return result
  }

  private evaluate(statId: number, param: number): number {
    getIscRow(statId) // throws for unknown stats (sub_6FDB5830 returns 0 for a missing record)
    const ctx = this.ctx
    // L181–192: own base stat + every attached list's total.
    let acc = ctx.base(statId, param) + this.listSum(statId, param);

    const sources = getIscOpSources(statId)
    if (sources.length === 0) return acc
    // L199: nPreviousOpStatValue captured before the op loop.
    let prev = acc
    for (const src of sources) {
      switch (src.op) {
        case 1: {
          // L209–227: any owner; for an item owner the base is the item's own base stat.
          if (ctx.owner === 'item') prev = ctx.base(statId, 0)
          if (prev !== 0) acc += statPercentage(prev, this.value(src.source, 0))
          break
        }
        case 2:
        case 3: {
          // L229–283: players/monsters; (opBase >> ValShift) must be > 0.
          if (ctx.owner === 'item' || src.opBase === null) break
          const shifted = this.value(src.opBase, 0) >> getIscRow(src.opBase).valShift
          if (shifted <= 0) break
          const r = this.value(src.source, 0)
          if (r === 0) break
          const temp = (shifted * r) >> src.opParam
          if (src.op === 2) acc += temp
          else acc = Math.trunc(acc + (temp * prev) / 100.0)
          break
        }
        case 4:
        case 5: {
          // L286–331: item lists attached to a player/monster (`pStatListEx->pUnit`); the unit's own
          // list has no pUnit, so these are item-local.
          if (ctx.owner !== 'item' || ctx.wearerTotal === null || src.opBase === null) break
          const tmp = ctx.wearerTotal(src.opBase) >> getIscRow(src.opBase).valShift
          if (tmp <= 0) break
          const r = this.value(src.source, 0)
          if (r === 0) break
          const temp = (tmp * r) >> src.opParam
          if (src.op === 4) acc += temp
          else acc = Math.trunc(acc + (prev * temp) / 100.0)
          break
        }
        case 6:
        case 7: {
          // L333–355: by-time properties need the act's period of day — not available client-side.
          if (this.value(src.source, 0) !== 0) {
            this.diagnostics.push({ target: statId, source: src.source, op: src.op })
          }
          break
        }
        case 8: {
          // L357–375: players only. (total(src) − own base(src)) · ManaPerMagic << 6.
          if (ctx.owner !== 'player') break
          if (!ctx.charStats) throw new StatEngineDataError('op 8 on a player without CharStats')
          const added = this.value(src.source, 0) - ctx.base(src.source, 0)
          if (added !== 0) acc += (added * ctx.charStats.manaPerMagic) << 6
          break
        }
        case 9: {
          // L377–402: players only. Stamina uses StaminaPerVitality, everything else LifePerVitality.
          if (ctx.owner !== 'player') break
          if (!ctx.charStats) throw new StatEngineDataError('op 9 on a player without CharStats')
          const added = this.value(src.source, 0) - ctx.base(src.source, 0)
          if (added !== 0) {
            const perPoint = statId === 11 ? ctx.charStats.staminaPerVitality : ctx.charStats.lifePerVitality
            acc += (added * perPoint) << 6
          }
          break
        }
        case 11: {
          // L404–411: players/monsters; percentage of the pre-loop accumulated value.
          if (ctx.owner === 'item') break
          if (prev !== 0) acc += statPercentage(prev, this.value(src.source, 0))
          break
        }
        case 13: {
          // L414–428: items only; percentage of the item's own base stat (e.g. ED% on base defense).
          if (ctx.owner !== 'item') break
          prev = ctx.base(statId, 0)
          if (prev !== 0) acc += statPercentage(prev, this.value(src.source, 0))
          break
        }
        default:
          break
      }
    }
    return acc
  }
}

// ============================================================================================
// Skill calc subset (passivecalc) — D2Skills.cpp SKILLS_GetSpecialParamValue / D2Common_11033
// ============================================================================================

/** `lnXY`: Param[X] + (lvl − 1) · Param[Y], 0 when lvl ≤ 0 (SKILLS_GetSpecialParamValue cases 0/2/4/6). */
function calcLinear(params: readonly number[], x: number, y: number, lvl: number): number {
  if (lvl <= 0) return 0
  return paramAt(params, x) + (lvl - 1) * paramAt(params, y)
}

/** `dmXY`: D2Common_11033 — Param[X] + (Param[Y] − Param[X]) · 110 · lvl / (lvl + 6) / 100, capped at Param[Y]. */
function calcDiminishing(params: readonly number[], x: number, y: number, lvl: number): number {
  if (lvl <= 0) return 0
  const min = paramAt(params, x)
  const max = paramAt(params, y)
  const value = min + Math.trunc(Math.trunc(((max - min) * 110 * lvl) / (lvl + 6)) / 100)
  return value > max ? max : value
}

function paramAt(params: readonly number[], oneBased: number): number {
  const value = params[oneBased - 1]
  if (value === undefined) throw new StatEngineDataError(`Skills.txt: no Param${oneBased}`)
  return value
}

export interface PassiveCalcContext {
  readonly skill: SkillsTxtRow
  /** Effective level of `skill` (SKILLS_GetSkillLevel(..., TRUE)). */
  readonly lvl: number
  /** Hard (base) points of any skill (`skill('X'.blvl)`). */
  baseLevelOf(skillId: number): number
  /** Effective level of any skill (`skill('X'.lvl)`). */
  effectiveLevelOf(skillId: number): number
}

/**
 * Evaluate a Skills.txt `passivecalcN` expression. Supported grammar (every form used by the 1.13c
 * passive-state rows): integers, + − * / ( ), `lvl`, `parN`, `lnXY`, `dmXY`,
 * `skill('Name'.blvl|lvl|parN|lnXY|dmXY)`. Integer arithmetic (C `int`, division truncates).
 * Anything else throws.
 */
export function evaluatePassiveCalc(expr: string, ctx: PassiveCalcContext): number {
  const tokens = tokenizeCalc(expr)
  let pos = 0
  const peek = (): string | undefined => tokens[pos]
  const next = (): string => {
    const t = tokens[pos++]
    if (t === undefined) throw new StatEngineDataError(`passivecalc '${expr}': unexpected end`)
    return t
  }
  const term = (skill: SkillsTxtRow, lvl: number, name: string): number => {
    if (name === 'lvl') return lvl
    if (name === 'blvl') return ctx.baseLevelOf(skill.id)
    let m = /^par([1-8])$/.exec(name)
    if (m) return paramAt(skill.params, Number(m[1]))
    m = /^ln([1-8])([1-8])$/.exec(name)
    if (m) return calcLinear(skill.params, Number(m[1]), Number(m[2]), lvl)
    m = /^dm([1-8])([1-8])$/.exec(name)
    if (m) return calcDiminishing(skill.params, Number(m[1]), Number(m[2]), lvl)
    throw new StatEngineDataError(`passivecalc '${expr}': unsupported term '${name}'`)
  }
  const primary = (): number => {
    const t = next()
    if (t === '(') {
      const v = additive()
      if (next() !== ')') throw new StatEngineDataError(`passivecalc '${expr}': expected ')'`)
      return v
    }
    if (t === '-') return -primary()
    if (/^\d+$/.test(t)) return Number(t)
    if (t === 'skill') {
      if (next() !== '(') throw new StatEngineDataError(`passivecalc '${expr}': expected '(' after skill`)
      const quoted = next()
      const m = /^'(.+)'$/.exec(quoted)
      if (!m) throw new StatEngineDataError(`passivecalc '${expr}': expected quoted skill name`)
      if (next() !== '.') throw new StatEngineDataError(`passivecalc '${expr}': expected '.'`)
      const field = next()
      if (next() !== ')') throw new StatEngineDataError(`passivecalc '${expr}': expected ')'`)
      const other = getSkillsRowByName(m[1] as string)
      return term(other, ctx.effectiveLevelOf(other.id), field)
    }
    return term(ctx.skill, ctx.lvl, t)
  }
  const multiplicative = (): number => {
    let v = primary()
    for (;;) {
      const op = peek()
      if (op === '*') {
        pos++
        v = Math.imul(v, primary())
      } else if (op === '/') {
        pos++
        const d = primary()
        if (d === 0) throw new StatEngineDataError(`passivecalc '${expr}': division by zero`)
        v = Math.trunc(v / d)
      } else {
        return v
      }
    }
  }
  const additive = (): number => {
    let v = multiplicative()
    for (;;) {
      const op = peek()
      if (op === '+') {
        pos++
        v += multiplicative()
      } else if (op === '-') {
        pos++
        v -= multiplicative()
      } else {
        return v
      }
    }
  }
  const result = additive()
  if (pos !== tokens.length) throw new StatEngineDataError(`passivecalc '${expr}': trailing '${tokens[pos]}'`)
  return result
}

function tokenizeCalc(expr: string): string[] {
  const tokens: string[] = []
  const re = /\s*('[^']*'|\d+|[A-Za-z_][A-Za-z0-9_]*|[()+\-*/.])/y
  let at = 0
  while (at < expr.length) {
    if (/^\s*$/.test(expr.slice(at))) break
    re.lastIndex = at
    const m = re.exec(expr)
    if (!m) throw new StatEngineDataError(`passivecalc '${expr}': bad token at ${at}`)
    tokens.push(m[1] as string)
    at = re.lastIndex
  }
  if (tokens.length === 0) throw new StatEngineDataError(`passivecalc '${expr}': empty`)
  return tokens
}

// ============================================================================================
// Items: socket mods, item-level FullStats (d)
// ============================================================================================

/** Gems.txt property set by the host's `gemapplytype` (0 weapon, 1 helm/armor, 2 shield). */
function gemModsForHost(gem: Gem, hostRow: BaseItemRow): readonly GemModifier[] {
  const applyType = hostRow.int('gemapplytype')
  switch (applyType) {
    case 0:
      return gem.weaponMods
    case 1:
      return gem.helmMods
    case 2:
      return gem.shieldMods
    default:
      throw new StatEngineDataError(`${hostRow.tableName} ${hostRow.text('code')}: gemapplytype ${applyType}`)
  }
}

function paramNumber(mod: GemModifier, gemCode: string): number | undefined {
  const raw = mod.param ?? mod.par
  if (raw === undefined || raw === '') return undefined
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isInteger(n)) throw new StatEngineDataError(`Gems.txt ${gemCode}: non-numeric param '${String(raw)}' on '${mod.code}'`)
  return n
}

/**
 * Stats a Gems.txt item contributes to its host (internal units: `value << ValShift`, matching the
 * explicit `<<= 8` of ItemMods.cpp sub_6FD94AB0 for the ValShift-8 pool stats).
 */
export function gemSocketStats(gemCode: string, hostRow: BaseItemRow): ItemStat[] {
  const gem = getGemRow(gemCode)
  const out: ItemStat[] = []
  for (const mod of gemModsForHost(gem, hostRow)) {
    const resolved = resolveProperty(mod.code, paramNumber(mod, gemCode), mod.min, mod.max, {
      properties: getPropertiesTable(),
      stats: getItemStatCostTable(),
    })
    if (resolved.length === 0) throw new StatEngineDataError(`Properties.txt: unresolved property '${mod.code}' (gem ${gemCode})`)
    for (const r of resolved) {
      const row = getIscRow(r.statId)
      const val = r.value * (1 << row.valShift)
      out.push({ statId: r.statId, param: r.param ?? 0, value: val })
      if (r.statId === 17 && !resolved.some((x) => x.statId === 18)) {
        out.push({ statId: 18, param: r.param ?? 0, value: val })
      }
    }
  }
  return out
}

/** One active (stat-giving) equipped item with its per-item lists and Weapons/Armor/Misc row. */
export interface ActiveEquipmentItem {
  readonly item: ItemData
  /** Body location (1..10 player; merc slots 1/3/4/5). */
  readonly bodyLoc: number
  readonly baseTable: ItemBaseTable
  readonly row: BaseItemRow
  /** Socketed children (`containers.sockets.get(item.id)`). */
  readonly socketChildren: readonly ItemData[]
  /**
   * Flat item-local list: own magic stats + runeword stats (wire lists as received) + socket children
   * (jewels: own stats; gems/runes: Gems.txt mods by host gemapplytype). Excludes set bonuses.
   */
  readonly localStats: readonly ItemStat[]
  /** The item's own base stats (wire `defense` → 31; Weapons.txt damage → 21/22, 23/24, 159/160). */
  readonly baseStats: readonly ItemStat[]
  /** Item FullStats after item-local ops (op 13/4/5/1): value(stat, param). */
  value(statId: number, param?: number): number
  /** All (stat, param) keys present on the item (base ∪ local ∪ item-local op targets), non-zero FullStats values. */
  readonly fullStats: readonly ItemStat[]
  /** Ops on this item the client cannot evaluate (op 6/7 by-time). */
  readonly diagnostics: readonly OpEngineDiagnostic[]
}

/** Weapon base damage stats from Weapons.txt (ITEMMODS_ApplyEthereality: ethereal ×3/2, int). */
function weaponBaseStats(item: ItemData, row: BaseItemRow): ItemStat[] {
  const out: ItemStat[] = []
  const pairs: readonly (readonly [string, number])[] = [
    ['mindam', 21],
    ['maxdam', 22],
    ['2handmindam', 23],
    ['2handmaxdam', 24],
    ['minmisdam', 159],
    ['maxmisdam', 160],
  ]
  for (const [column, statId] of pairs) {
    const v = row.intOrBlank(column)
    if (v === null) continue
    out.push({ statId, param: 0, value: item.ethereal ? Math.trunc((3 * v) / 2) : v })
  }
  return out
}

function buildEquipmentItem(
  item: ItemData,
  bodyLoc: number,
  containers: ClientItemContainers,
  wearerTotal: (statId: number) => number,
  activeEquipped?: readonly ItemData[],
): ActiveEquipmentItem {
  const { table, row } = getItemBaseRow(item.code)
  const children = containers.sockets.get(item.id) ?? []
  const local = new FlatStatList()
  // Wire lists as received: the server omits the magic lists of unidentified items (Items.cpp:7216
  // `bServer || IFLAG_IDENTIFIED`), and the runeword list exists only with IFLAG_RUNEWORD.
  local.addAll(item.stats)
  if (item.runeword || (item.runewordStats && item.runewordStats.length > 0)) {
    local.addAll(item.runewordStats)
  }
  if (activeEquipped) {
    local.addAll(computeItemSetBonusStats(item, activeEquipped))
  }
  for (const child of children) {
    if (isGemsTxtItem(child.code) && child.code !== 'jew' && (!child.stats || child.stats.length === 0)) {
      local.addAll(gemSocketStats(child.code, row))
    } else {
      local.addAll(child.stats)
    }
  }
  if (local.get(17, 0) !== 0 && local.get(18, 0) === 0) {
    local.add(18, 0, local.get(17, 0))
  }
  const base = new FlatStatList()
  if (table === 'weapons') {
    base.addAll(weaponBaseStats(item, row))
  } else if (table === 'armor') {
    if (item.defense === undefined) throw new StatEngineDataError(`armor item ${item.code} (#${item.id}) has no wire defense`)
    base.add(31, 0, item.defense)
  }
  const engine = new StatOpEngine({
    owner: 'item',
    base: (statId, param) => base.get(statId, param),
    lists: [local],
    charStats: null,
    wearerTotal,
  })
  const keys = new Map<string, { statId: number; param: number }>()
  for (const s of [...base.entries(), ...local.entries()]) keys.set(statKey(s.statId, s.param), { statId: s.statId, param: s.param })
  // Targets of item-local ops on present sources (e.g. 16 → armorclass) are part of FullStats too.
  for (const s of local.entries()) {
    for (const target of getIscRow(s.statId).opStats) keys.set(statKey(target, 0), { statId: target, param: 0 })
  }
  const fullStats: ItemStat[] = []
  for (const { statId, param } of keys.values()) {
    const value = engine.value(statId, param)
    if (value !== 0) fullStats.push({ statId, param, value })
  }
  return {
    item,
    bodyLoc,
    baseTable: table,
    row,
    socketChildren: children,
    localStats: local.entries(),
    baseStats: base.entries(),
    value: (statId: number, param = 0) => engine.value(statId, param),
    fullStats,
    diagnostics: engine.diagnostics,
  }
}

/** Player stat-giving body locations (rules 23–24): 1..10; 11/12 (swap set) never give stats. */
export const PLAYER_ACTIVE_BODY_LOCS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
/** Mercenary body locations (rule 7b): head 1, torso 3, right arm 4, left arm 5. */
export const MERC_ACTIVE_BODY_LOCS: readonly number[] = [1, 3, 4, 5]

/** (d) Active (stat-giving) equipment of the player or the merc, broken items excluded. */
export function activeEquipment(
  containers: ClientItemContainers,
  unit: 'player' | 'merc',
  wearerLevel: number,
): ActiveEquipmentItem[] {
  const bySlot = unit === 'player' ? containers.equipmentBySlot : containers.mercBySlot
  const fallbackMap = unit === 'player' ? containers.equipment : containers.merc
  const locs = unit === 'player' ? PLAYER_ACTIVE_BODY_LOCS : MERC_ACTIVE_BODY_LOCS
  const resolvedByLoc = new Map<number, ItemData>()
  for (const loc of locs) {
    let item = bySlot?.get(loc)
    if (!item && fallbackMap) {
      for (const candidate of fallbackMap.values()) {
        if ((candidate.bodyLoc || candidate.equippedSlot || 0) === loc) {
          item = candidate
          break
        }
      }
    }
    if (!item || item.broken) continue
    resolvedByLoc.set(loc, item)
  }
  const activeEquipped = [...resolvedByLoc.values()]
  const out: ActiveEquipmentItem[] = []
  for (const loc of locs) {
    const item = resolvedByLoc.get(loc)
    if (!item) continue
    out.push(buildEquipmentItem(item, loc, containers, wearerLevelLookup(wearerLevel), activeEquipped))
  }
  return out
}

/**
 * Inventory-grid charms (player only): Misc type descending from ItemTypes `char`, identified,
 * not broken, `wearerLevel >= reqLevel`, and unique charms deduplicated by `uniqueItemId`
 * (`D2Common.dll` 1.13c `ITEMS_IsCharmUsable` @ `0x6fd77090` / `ITEMS_CheckRequirements` @ `0x6fd76db0`).
 */
export function activeCharms(
  containers: ClientItemContainers,
  wearerLevel = 0,
  charClass?: CharacterClassCode | string | null,
): ItemData[] {
  const out: ItemData[] = []
  const seenUniqueCharmIds = new Set<number>()
  for (const item of containers.inventory.values()) {
    if ((item.container !== undefined && item.container !== 'inventory') || item.broken) continue
    if (item.identified === false || (item as any).flags?.identified === false) continue
    if (!itemCodeIsA(item.code, 'char')) continue
    if (wearerLevel > 0) {
      const reqLvl = resolveOnlineItemReqLevel(item, undefined, undefined, charClass)
      if (reqLvl > 0 && wearerLevel < reqLvl) continue
    }
    const isUnique = item.quality === 7 || (item.quality as unknown) === 'unique'
    const uid = item.uniqueItemId ?? (item as any).uniqueId
    if (isUnique && typeof uid === 'number' && uid >= 0) {
      if (seenUniqueCharmIds.has(uid)) continue
      seenUniqueCharmIds.add(uid)
    }
    out.push(item)
  }
  return out
}

// ============================================================================================
// (c) Per-unit aggregation (player + merc)
// ============================================================================================

export type StatSourceKind = 'item' | 'charm' | 'state' | 'passive'

export interface StatSource {
  readonly kind: StatSourceKind
  /** Item id (item/charm), state id (state/passive). */
  readonly id: number
  /** For passives: the skill id; for items: the body loc. */
  readonly detail: number
  readonly stats: FlatStatList
}

/** Minimal unit view the aggregator needs (player self or merc unit). */
export interface StatEngineUnitInput {
  readonly kind: 'player' | 'merc'
  readonly stats: StatList
  /** Optional explicit character/unit level fallback when stat 12 is not populated in `stats`. */
  readonly level?: number | undefined
  readonly activeStates: ReadonlySet<number>
  /** Player only (null for the merc). */
  readonly classId: CharClassId | null
  /** Player only: hard points per skill (0x94 / 0x21 base level). */
  readonly hardSkillLevels: ReadonlyMap<number, number> | null
  readonly containers: ClientItemContainers
}

export interface SkillLevelResult {
  /** Hard points (0x94 / 0x21 base level; 0 when the unit has no entry). */
  readonly hard: number
  /** SKILLS_GetSkillLevel(pUnit, pSkill, TRUE): hard + SKILLS_GetBonusSkillLevel, floored at 0. */
  readonly effective: number
}

export interface UnitAggregate {
  readonly kind: 'player' | 'merc'
  readonly isPlayer: boolean
  readonly classCode: CharacterClassCode | null
  /** clvl = unit's base stat 12. */
  readonly level: number
  /** Server base value (`stats.getBase`). */
  base(statId: number, param?: number): number
  /** Final value after the op engine with every source attached (internal units). */
  total(statId: number, param?: number): number
  /** Same with every non-passive 0xA8 state list excluded (rule 16 base* values). */
  withoutStates(statId: number, param?: number): number
  /** Flat Σ of the selected source kinds (no base, no ops). */
  flatSum(statId: number, param: number, kinds: readonly StatSourceKind[]): number
  readonly equipment: readonly ActiveEquipmentItem[]
  readonly charms: readonly ItemData[]
  readonly sources: readonly StatSource[]
  /** (e) effective skill level (player; throws for the merc). */
  effectiveSkillLevel(skillId: number): SkillLevelResult
  /** Ops the client could not evaluate (by-time items). */
  readonly diagnostics: readonly OpEngineDiagnostic[]
}

function stateSources(stats: StatList): StatSource[] {
  const out: StatSource[] = []
  for (const stateId of (typeof stats.stateIds === 'function' ? stats.stateIds() : [])) {
    const list = stats.getStateStats(stateId)
    if (!list) continue
    const flat = new FlatStatList()
    flat.addAll(list)
    out.push({ kind: isPassiveState(stateId) ? 'passive' : 'state', id: stateId, detail: -1, stats: flat })
  }
  return out
}

function itemFlatList(entry: ActiveEquipmentItem): FlatStatList {
  const flat = new FlatStatList()
  flat.addAll(entry.fullStats)
  return flat
}

function charmFlatList(charm: ItemData, wearerLevel: number): FlatStatList {
  const local = new FlatStatList()
  // Wire list as received (unidentified charms carry no magic list on the wire, Items.cpp:7216).
  local.addAll(charm.stats)
  // Charms are item lists too: run their item-local ops (none of the charm stats target item-local
  // stats in 1.13c, but the engine stays data-driven).
  const engine = new StatOpEngine({
    owner: 'item',
    base: () => 0,
    lists: [local],
    charStats: null,
    wearerTotal: wearerLevelLookup(wearerLevel),
  })
  const flat = new FlatStatList()
  for (const s of local.entries()) flat.add(s.statId, s.param, engine.value(s.statId, s.param))
  return flat
}

/**
 * Op 4/5 read the wearer's `op base` stat. Every 1.13c op 4/5 row (214/215/218/219…) uses `level`
 * (stat 12); any other op base is a data error.
 */
function wearerLevelLookup(wearerLevel: number): (statId: number) => number {
  return statId => {
    if (statId !== 12) throw new StatEngineDataError(`op 4/5 with op base ${statId} (only 'level' is supported)`)
    return wearerLevel
  }
}

/**
 * SKILLS_GetBonusSkillLevel (D2Skills.cpp, D2Common.0x6FDB1580) for a player:
 * Skill Shrine +2 (STATE_SHRINE_SKILL) + 127 allskills + [class skill: 83(classId) + 188(page + 8·classId − 1)
 * + min(97(skill), 3)] | [non-class: 97(skill)] + 126(EType) + 107(skill). `pSkill->nLevelBonus` is a
 * server-only field (not on the wire) and is not modelled.
 */
function bonusSkillLevel(total: (id: number, p: number) => number, classId: CharClassId, skill: SkillsTxtRow, activeStates: ReadonlySet<number>): number {
  let bonus = 0
  if (activeStates.has(getStateIdByName('shrine_skill'))) bonus += 2
  bonus += total(127, 0)
  const classCode = classCodeFromId(classId)
  if (skill.charclass === classCode) {
    bonus += total(83, classId)
    if (skill.skillPage !== 0) bonus += total(188, skill.skillPage + 8 * classId - 1)
    const oskill = total(97, skill.id)
    bonus += oskill > 3 ? 3 : oskill
  } else {
    bonus += total(97, skill.id)
  }
  if (skill.eType !== 0) bonus += total(126, skill.eType)
  return bonus + total(107, skill.id)
}

/** Build the per-unit aggregate (player: items + charms + states + passives; merc: items + states). */
export function aggregateUnit(input: StatEngineUnitInput): UnitAggregate {
  const isPlayer = input.kind === 'player'
  const stats = input.stats
   
  const statLevel = stats.has(12) ? (typeof stats.getBase === 'function' ? stats.getBase(12) : stats.get(12)) : 0
  const level =
    typeof input.level === 'number' && input.level > 0
      ? input.level
      : statLevel > 0
        ? statLevel
        : 1
  const classCode = isPlayer ? classCodeFromId(requireClassId(input.classId)) : null
  const charStats = classCode ? getCharStatsRow(classCode) : null

  const equipment = activeEquipment(input.containers, input.kind, level)
  const charms = isPlayer ? activeCharms(input.containers, level, classCode) : []
  const sources: StatSource[] = []
  for (const e of equipment) sources.push({ kind: 'item', id: e.item.id, detail: e.bodyLoc, stats: itemFlatList(e) })
  for (const c of charms) sources.push({ kind: 'charm', id: c.id, detail: -1, stats: charmFlatList(c, level) })
  
  const activeEquipped = equipment.map(e => e.item)
  const setBonuses = computeFullSetBonusStats(activeEquipped)
  if (setBonuses.length > 0) {
    sources.push({ kind: 'passive', id: -1, detail: 0, stats: (() => { const f = new FlatStatList(); f.addAll(setBonuses); return f })() })
  }

  const fromStates = stateSources(stats)
  sources.push(...fromStates)

  // Barbarian #155 Battle Command (state 51): +1 to All Skills (stat 127 item_allskills).
  // Must be added before prePassive so effectiveSkillLevel(), passives, and Shout/Battle Orders include +1.
  if (isPlayer && input.activeStates.has(51) && !fromStates.some(s => s.kind === 'state' && s.id === 51)) {
    const bcFlat = new FlatStatList()
    bcFlat.add(127, 0, 1)
    sources.push({ kind: 'state', id: 51, detail: 155, stats: bcFlat })
  }

  const base = (statId: number, param: number): number => (typeof stats.getBase === 'function' ? stats.getBase(statId, param) : stats.get(statId, param)) ?? 0
  const owner: StatOwnerKind = isPlayer ? 'player' : 'monster'

  // +skills stats carry no ops: a pre-passive engine gives their totals (no circularity with passives).
  const prePassive = new StatOpEngine({ owner, base, lists: sources.map(s => s.stats), charStats, wearerTotal: null })
  const hardLevels = input.hardSkillLevels
  const effectiveSkillLevel = (skillId: number): SkillLevelResult => {
    if (!isPlayer || hardLevels === null || input.classId === null) {
      throw new StatEngineDataError('effectiveSkillLevel is only defined for the player')
    }
    const skill = getSkillsRow(skillId)
    const hard = hardLevels.get(skillId) ?? 0
    const effective = hard + bonusSkillLevel((id, p) => prePassive.value(id, p), input.classId, skill, input.activeStates)
    return { hard, effective: effective < 0 ? 0 : effective }
  }

  // Passives (rule 10), player only, for skills without a server-sent passive list.
  if (isPlayer && hardLevels !== null) {
    const serverPassiveStates = new Set(fromStates.filter(s => s.kind === 'passive').map(s => s.id))
    for (const skillId of hardLevels.keys()) {
      if ((hardLevels.get(skillId) ?? 0) <= 0) continue
      const skill = getSkillsRow(skillId)
      if (skill.passiveState === null || skill.passiveStats.length === 0) continue
      if (serverPassiveStates.has(skill.passiveState)) continue
      if (skill.auraState !== null && input.activeStates.has(skill.auraState)) continue
      const lvl = effectiveSkillLevel(skillId).effective
      if (lvl <= 0) continue
      const flat = new FlatStatList()
      const param = skill.passiveItype === '' ? 0 : getItemTypeIndex(skill.passiveItype)
      for (const ps of skill.passiveStats) {
        const value = evaluatePassiveCalc(ps.calc, {
          skill,
          lvl,
          baseLevelOf: id => hardLevels.get(id) ?? 0,
          effectiveLevelOf: id => effectiveSkillLevel(id).effective,
        })
        flat.add(ps.stat, param, value)
        if (ps.stat === 348 && param !== 0) {
          flat.add(ps.stat, 0, value)
        }
      }
      sources.push({ kind: 'passive', id: skill.passiveState, detail: skillId, stats: flat })
    }

    // Active Paladin defensive auras and Barbarian combat/warcry states without an explicit server 0xA8 state stat list.
    const serverActiveStates = new Set(fromStates.filter(s => s.kind === 'state').map(s => s.id))
    const addAuraStateSource = (
      stateId: number,
      skillId: number,
      populate: (flat: FlatStatList, effLvl: number, hardLvl: number) => void,
    ) => {
      if (!input.activeStates.has(stateId) || serverActiveStates.has(stateId)) return
      const sl = effectiveSkillLevel(skillId)
      if (sl.effective <= 0) return
      const flat = new FlatStatList()
      populate(flat, sl.effective, sl.hard)
      sources.push({ kind: 'state', id: stateId, detail: skillId, stats: flat })
    }
    addAuraStateSource(3, 100, (flat, eff, hard) => {
      const rf = calculateResistFireStats(eff, hard)
      flat.add(39, 0, rf.fireResistPct)
      flat.add(40, 0, rf.maxFireResistBonusPct)
    })
    addAuraStateSource(4, 105, (flat, eff, hard) => {
      const rc = calculateResistColdStats(eff, hard)
      flat.add(43, 0, rc.coldResistPct)
      flat.add(44, 0, rc.maxColdResistBonusPct)
    })
    addAuraStateSource(5, 110, (flat, eff, hard) => {
      const rl = calculateResistLightningStats(eff, hard)
      flat.add(41, 0, rl.lightningResistPct)
      flat.add(42, 0, rl.maxLightningResistBonusPct)
    })
    addAuraStateSource(8, 125, (flat, eff) => {
      const salv = calculateSalvationStats(eff)
      flat.add(39, 0, salv.fireResistPct)
      flat.add(41, 0, salv.lightningResistPct)
      flat.add(43, 0, salv.coldResistPct)
    })
    addAuraStateSource(37, 104, (flat, eff) => {
      flat.add(171, 0, calculateDefianceStats(eff).defensePercent)
    })
    addAuraStateSource(41, 115, (flat, eff) => {
      const vig = calculateVigorStats(eff)
      flat.add(163, 0, vig.maxStaminaPercent)
      flat.add(28, 0, vig.staminaRecoveryBonusPct)
      flat.add(67, 0, vig.velocityPercent)
    })
    // Paladin Offensive Auras: Might (#98, state 33), Holy Fire (#102, state 35), Blessed Aim (#108, state 40),
    // Concentration (#113, state 42), Holy Freeze (#114, state 43), Holy Shock (#118, state 46), Fanaticism (#122, state 49).
    addAuraStateSource(33, 98, (flat, eff) => {
      flat.add(25, 0, calculateMightStats(eff).damagePercent)
    })
    addAuraStateSource(35, 102, (flat, eff) => {
      const hf = calculateHolyFireStats(eff, {
        resistFire: Math.max(0, hardLevels.get(100) ?? 0),
        salvation: Math.max(0, hardLevels.get(125) ?? 0),
      })
      flat.add(48, 0, hf.weaponFireMin)
      flat.add(49, 0, hf.weaponFireMax)
    })
    addAuraStateSource(40, 108, (flat, eff, hard) => {
      flat.add(119, 0, calculateBlessedAimStats(eff, hard).attackRatingPct)
    })
    addAuraStateSource(42, 113, (flat, eff) => {
      flat.add(25, 0, calculateConcentrationStats(eff).damagePercent)
    })
    addAuraStateSource(43, 114, (flat, eff) => {
      const hfr = calculateHolyFreezeStats(eff, {
        resistCold: Math.max(0, hardLevels.get(105) ?? 0),
        salvation: Math.max(0, hardLevels.get(125) ?? 0),
      })
      flat.add(54, 0, hfr.weaponColdMin)
      flat.add(55, 0, hfr.weaponColdMax)
    })
    addAuraStateSource(46, 118, (flat, eff) => {
      const hs = calculateHolyShockStats(eff, {
        resistLightning: Math.max(0, hardLevels.get(110) ?? 0),
        salvation: Math.max(0, hardLevels.get(125) ?? 0),
      })
      flat.add(50, 0, hs.weaponLightningMin)
      flat.add(51, 0, hs.weaponLightningMax)
    })
    addAuraStateSource(49, 122, (flat, eff) => {
      const fan = calculateFanaticismStats(eff)
      flat.add(25, 0, fan.casterDamagePercent)
      flat.add(119, 0, fan.attackRatingPct)
      flat.add(68, 0, fan.casterIas)
    })
    // Barbarian #144 Concentrate (state 15): +100 + 10*(slvl-1) + 10*blvl(Iron Skin #145) % Defense
    addAuraStateSource(15, 144, (flat, eff) => {
      const ironSkinHard = Math.max(0, hardLevels.get(145) ?? 0)
      flat.add(171, 0, 100 + 10 * (eff - 1) + 10 * ironSkinHard)
    })
    // Barbarian #138 Shout (state 26): +100 + 10*(slvl-1) % Defense
    addAuraStateSource(26, 138, (flat, eff) => {
      flat.add(171, 0, 100 + 10 * (eff - 1))
    })
    // Barbarian #149 Battle Orders (state 32): +35 + 3*(slvl-1) % Max HP/Mana/Stamina
    addAuraStateSource(32, 149, (flat, eff) => {
      const boPct = 35 + 3 * (eff - 1)
      flat.add(76, 0, boPct)
      flat.add(77, 0, boPct)
      flat.add(163, 0, boPct)
    })
    // Barbarian #152 Berserk (state 95): sets STAT_ARMOR_OVERRIDE_PERCENT (182) = -100, reducing defense to 0
    if (input.activeStates.has(95) && !serverActiveStates.has(95)) {
      const berserkFlat = new FlatStatList()
      berserkFlat.add(182, 0, -100)
      const sl = effectiveSkillLevel(152)
      if (sl.effective > 0) {
        const howlHard = Math.max(0, hardLevels.get(130) ?? 0)
        const shoutHard = Math.max(0, hardLevels.get(138) ?? 0)
        berserkFlat.add(25, 0, 150 + 15 * (sl.effective - 1) + 10 * (howlHard + shoutHard))
      }
      sources.push({ kind: 'state', id: 95, detail: 152, stats: berserkFlat })
    }
    // Druid #223 Werewolf (state 139): +25% + Lycanthropy % Max HP (76), +25% Stamina (163), +IAS (68), +AR% (119)
    addAuraStateSource(139, 223, (flat, eff) => {
      const lycanLvl = effectiveSkillLevel(224).effective
      const lycanHpBonus = lycanLvl > 0 ? 20 + 5 * (lycanLvl - 1) : 0
      const iasBonus = Math.floor((110 * eff * 70) / (100 * (eff + 6))) + 10
      flat.add(76, 0, 25 + lycanHpBonus)
      flat.add(163, 0, 25)
      flat.add(68, 0, iasBonus)
      flat.add(119, 0, 50 + 15 * (eff - 1))
    })
    // Druid #228 Werebear (state 140): +50% + Lycanthropy % Max HP (76), +50 + 8*(slvl-1)% ED (25), +25 + 6*(slvl-1)% Defense (171)
    addAuraStateSource(140, 228, (flat, eff) => {
      const lycanLvl = effectiveSkillLevel(224).effective
      const lycanHpBonus = lycanLvl > 0 ? 20 + 5 * (lycanLvl - 1) : 0
      flat.add(76, 0, 50 + lycanHpBonus)
      flat.add(25, 0, 50 + 8 * (eff - 1))
      flat.add(171, 0, 25 + 6 * (eff - 1))
    })
    // Druid #232 Feral Rage (state 120): +FRW (67) and +Life Steal (60)
    addAuraStateSource(120, 232, (flat, eff) => {
      const frw = Math.floor((110 * eff * 60) / (100 * (eff + 6))) + 10
      flat.add(67, 0, frw)
      flat.add(60, 0, 4 * eff)
    })
    // Druid #233 Maul (state 117): +20% per charge ED (25)
    addAuraStateSource(117, 233, (flat, eff) => {
      flat.add(25, 0, 20 * eff)
    })
    // Druid #226 Oak Sage (state 149 'oaksage', sub-skill #296): +30 + 5*(slvl-1)% Max HP (76)
    addAuraStateSource(149, 226, (flat, eff) => {
      flat.add(76, 0, 30 + 5 * (eff - 1))
    })
    // Druid #236 Heart of Wolverine (state 148 'wolverine', sub-skill #297): +20 + 7*(slvl-1)% ED (25), +25 + 7*(slvl-1)% AR (119)
    addAuraStateSource(148, 236, (flat, eff) => {
      flat.add(25, 0, 20 + 7 * (eff - 1))
      flat.add(119, 0, 25 + 7 * (eff - 1))
    })
    // Druid #246 Spirit of Barbs (state 147 'barbs', sub-skill #298): +50 + 20*(slvl-1)% Thorns (131)
    addAuraStateSource(147, 246, (flat, eff) => {
      flat.add(131, 0, 50 + 20 * (eff - 1))
    })
    // Assassin Shadow Disciplines active buff states (skills with passiveState === null):
    // #258 Burst of Speed (state 157 'quickness'), #267 Fade (state 159 'fade'),
    // #264 Cloak of Shadows (state 153 'cloaked'), #278 Venom (state 31 'venomclaws').
    const addAssassinBuffStateSource = (
      stateId: number,
      skillId: number,
      populate: (flat: FlatStatList, effLvl: number) => void,
    ) => {
      if (!input.activeStates.has(stateId) || serverActiveStates.has(stateId)) return
      const sl = effectiveSkillLevel(skillId)
      const eff = sl.effective > 0 ? sl.effective : 1
      const flat = new FlatStatList()
      populate(flat, eff)
      sources.push({ kind: 'state', id: stateId, detail: skillId, stats: flat })
    }
    // #258 Burst of Speed (state 157 'quickness'): FRW dm(15, 70)% (stat 67), IAS dm(15, 60)% (stat 68)
    addAssassinBuffStateSource(157, 258, (flat, eff) => {
      const frw = calcDiminishing([15, 70, 15, 60, 3000, 300, 0, 0], 1, 2, eff)
      const ias = calcDiminishing([15, 70, 15, 60, 3000, 300, 0, 0], 3, 4, eff)
      flat.add(67, 0, frw)
      flat.add(68, 0, ias)
    })
    // #267 Fade (state 159 'fade'): All Res dm(10, 75)% (stats 39, 41, 43, 45), Curse Res dm(40, 90)% (stat 109), DR +1%/slvl (stat 36)
    addAssassinBuffStateSource(159, 267, (flat, eff) => {
      const allRes = calcDiminishing([10, 75, 40, 90, 3000, 300, 1, 1], 1, 2, eff)
      const curseRes = calcDiminishing([10, 75, 40, 90, 3000, 300, 1, 1], 3, 4, eff)
      flat.add(39, 0, allRes)
      flat.add(41, 0, allRes)
      flat.add(43, 0, allRes)
      flat.add(45, 0, allRes)
      flat.add(109, 0, curseRes)
      flat.add(36, 0, eff)
    })
    // #264 Cloak of Shadows (state 153 'cloaked'): self +Defense% = 10 + 3*(slvl-1)% (stat 16 & stat 171)
    addAssassinBuffStateSource(153, 264, (flat, eff) => {
      const defPct = 10 + 3 * (eff - 1)
      flat.add(16, 0, defPct)
      flat.add(171, 0, defPct)
    })
    // #278 Venom (state 31 'venomclaws'): 0.4s (10-frame) poison bitrate (stats 57, 58, 101=10)
    addAssassinBuffStateSource(31, 278, (flat, eff) => {
      const bandAdd =
        Math.min(Math.max(0, eff - 1), 7) * 6 +
        Math.min(Math.max(0, eff - 8), 8) * 8 +
        Math.min(Math.max(0, eff - 16), 6) * 10 +
        Math.min(Math.max(0, eff - 22), 6) * 12 +
        Math.max(0, eff - 28) * 14
      flat.add(57, 0, (24 + bandAdd) << 6)
      flat.add(58, 0, (32 + bandAdd) << 6)
      flat.add(101, 0, 10)
    })
  }

  const totalEngine = new StatOpEngine({ owner, base, lists: sources.map(s => s.stats), charStats, wearerTotal: null })
  const noStateEngine = new StatOpEngine({
    owner,
    base,
    lists: sources.filter(s => s.kind !== 'state').map(s => s.stats),
    charStats,
    wearerTotal: null,
  })

  return {
    kind: input.kind,
    isPlayer,
    classCode,
    level,
    base: (statId, param = 0) => (typeof stats.getBase === 'function' ? stats.getBase(statId, param) : stats.get(statId, param)) ?? 0,
    total: (statId, param = 0) => {
      if (statId === 31 && param === 0 && (input.activeStates.has(95) || totalEngine.value(182, 0) <= -100)) {
        return 0
      }
      return totalEngine.value(statId, param)
    },
    withoutStates: (statId, param = 0) => noStateEngine.value(statId, param),
    flatSum: (statId, param, kinds) => {
      let sum = 0
      for (const s of sources) if (kinds.includes(s.kind)) sum += (s.stats.get(statId, param) ?? 0)
      return sum
    },
    equipment,
    charms,
    sources,
    effectiveSkillLevel,
    get diagnostics() {
      return [...equipment.flatMap(e => e.diagnostics), ...totalEngine.diagnostics, ...noStateEngine.diagnostics]
    },
  }
}

function requireClassId(classId: CharClassId | null): CharClassId {
  if (classId === null) throw new StatEngineDataError('player class not assigned yet')
  return classId
}
