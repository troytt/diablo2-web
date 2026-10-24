/**
 * Diablo II ItemStatCost.txt and Properties.txt loader, property resolution,
 * and serialization bitwidth definitions.
 *
 * References 1.13c:
 * - ItemStatCost.txt: 359 rows (IDs 0..358, 9-bit in .d2s item saves), 53 columns.
 * - Properties.txt: 268 data rows (filtering out 1 'Expansion' separator row).
 */

import type { D2Table } from '../world/acts.ts'
import { parseTable } from '../world/acts.ts'
import type { MountedArchives } from '../mpq/mount.ts'
import { encodeSkillTabParam } from '../skills/skills-data.ts'

export const ITEM_STAT_COST_PATH = 'data\\global\\excel\\ItemStatCost.txt'
export const PROPERTIES_PATH = 'data\\global\\excel\\Properties.txt'

/** One record from ItemStatCost.txt. */
export interface ItemStatCostRecord {
  /** Primary key name (e.g. 'strength', 'armorclass'). */
  readonly Stat: string
  /** Alias for Stat. */
  readonly stat: string
  /** Numeric stat ID (0..358, stored in 9 bits in .d2s item serialization). */
  readonly id: number
  /** Whether the stat value is signed. */
  readonly signed: boolean
  /** Bits used for transmission over network. */
  readonly sendBits: number
  /** Bits used for network transmission parameter. */
  readonly sendParamBits: number
  /** Whether this stat is saved. */
  readonly saved: boolean
  /** Bits used when saved on an item (.d2s serialization). Uses 'Save Bits', NOT '1.09-Save Bits'. */
  readonly saveBits: number
  /** Bias added before unsigned saving on an item. Uses 'Save Add', NOT '1.09-Save Add'. */
  readonly saveAdd: number
  /** Bits used for saved parameter. */
  readonly saveParamBits: number
  /** Operator code for calculation. */
  readonly op: number
  /** Parameter for operator. */
  readonly opParam: number
  /** Base stat for operator. */
  readonly opBase: string
  /** Target stat 1 for operator. */
  readonly opStat1: string
  /** Target stat 2 for operator. */
  readonly opStat2: string
  /** Target stat 3 for operator. */
  readonly opStat3: string
  /** Priority for item tooltip description sorting. */
  readonly descPriority: number
  /** Formatting function for item tooltip description. */
  readonly descFunc: number
  /** Position of value in description (0: none, 1: before, 2: after). */
  readonly descVal: number
  /** String key for positive value. */
  readonly descStrPos: string
  /** String key for negative value. */
  readonly descStrNeg: string
  /** Secondary string key. */
  readonly descStr2: string
  /** Display group ID for grouping multiple stats (e.g. all attributes). */
  readonly dgrp: number
  /** Formatting function for display group. */
  readonly dgrpFunc: number
  /** Value position for display group. */
  readonly dgrpVal: number
  /** String key for positive display group. */
  readonly dgrpStrPos: string
  /** String key for negative display group. */
  readonly dgrpStrNeg: string
  /** Secondary string key for display group. */
  readonly dgrpStr2: string
  /** Value precision shift. */
  readonly valShift: number
  /** Encode mode (0=normal, 1=skill str, 2=skill on hit/attack/level/kill/gethit, 3=charged skill, 4=by-time). */
  readonly encode: number
  /** Price divide factor. */
  readonly divide: number
  /** Price multiply factor. */
  readonly multiply: number
  /** Price add constant. */
  readonly add: number
}

/** Parsed ItemStatCost table with indexed lookups. */
export interface ItemStatCostTable {
  /** The underlying raw parsed D2Table. */
  readonly table: D2Table
  /** All parsed records in table order. */
  readonly records: readonly ItemStatCostRecord[]
  /** Alias for records. */
  readonly rows: readonly ItemStatCostRecord[]
  /** Lookup map by stat name (exact match). */
  readonly byStat: ReadonlyMap<string, ItemStatCostRecord>
  /** Lookup map by numeric stat ID (0..358). */
  readonly byId: ReadonlyMap<number, ItemStatCostRecord>
  /** Lookup a record by stat name or numeric ID. */
  get(statOrId: string | number): ItemStatCostRecord | undefined
  /** Lookup a record by stat name. */
  getByStat(stat: string): ItemStatCostRecord | undefined
  /** Lookup a record by numeric stat ID. */
  getById(id: number): ItemStatCostRecord | undefined
}

/** One stat modification slot within a property definition (1..7). */
export interface PropertyStatEntry {
  /** Slot index (1..7). */
  readonly index: number
  /** Parameter/set value. */
  readonly set: number
  /** Parameter/class/group value. */
  readonly val: number
  /** Function code determining how parameters map to stats. */
  readonly func: number
  /** Target stat name (references ItemStatCost.txt). */
  readonly stat: string
}

/** One record from Properties.txt. */
export interface PropertyRecord {
  /** Primary key property identifier (e.g. 'ac', 'str', 'dmg-cold'). */
  readonly code: string
  /** Active stat modification slots (up to 7). */
  readonly stats: readonly PropertyStatEntry[]
  // Flat properties for direct column access
  readonly set1: number
  readonly val1: number
  readonly func1: number
  readonly stat1: string
  readonly set2: number
  readonly val2: number
  readonly func2: number
  readonly stat2: string
  readonly set3: number
  readonly val3: number
  readonly func3: number
  readonly stat3: string
  readonly set4: number
  readonly val4: number
  readonly func4: number
  readonly stat4: string
  readonly set5: number
  readonly val5: number
  readonly func5: number
  readonly stat5: string
  readonly set6: number
  readonly val6: number
  readonly func6: number
  readonly stat6: string
  readonly set7: number
  readonly val7: number
  readonly func7: number
  readonly stat7: string
}

/** Parsed Properties table with indexed lookups and property resolution. */
export interface PropertiesTable {
  /** The underlying raw parsed D2Table. */
  readonly table: D2Table
  /** All parsed property records in table order. */
  readonly records: readonly PropertyRecord[]
  /** Alias for records. */
  readonly rows: readonly PropertyRecord[]
  /** Lookup map by property code. */
  readonly byCode: ReadonlyMap<string, PropertyRecord>
  /** Lookup a property by code. */
  get(code: string): PropertyRecord | undefined
  /** Lookup a property by code. */
  getByCode(code: string): PropertyRecord | undefined
  /** Resolve a property into concrete stat modifications. */
  resolveProperty(
    propCode: string,
    param?: number,
    min?: number,
    max?: number,
    stats?: ItemStatCostTable
  ): ResolvedStat[]
}

/** The result of resolving a property into a concrete stat modification. */
export interface ResolvedStat {
  /** Stat name as specified in ItemStatCost.txt. */
  readonly stat: string
  /** Numeric stat ID (0..358) from ItemStatCost.txt. */
  readonly statId: number
  /** Alias for statId. */
  readonly id: number
  /** Function code from Properties.txt. */
  readonly func: number
  /** Resolved minimum stat bonus. */
  readonly min: number
  /** Resolved maximum stat bonus. */
  readonly max: number
  /** Resolved stat bonus value. */
  readonly value: number
  /** Optional parameter (e.g. skill ID, class ID, duration frames). */
  readonly param?: number | undefined
  /** Serialization bitwidth: Save Bits from ItemStatCost.txt. */
  readonly saveBits: number
  /** Serialization bias: Save Add from ItemStatCost.txt. */
  readonly saveAdd: number
  /** Parameter bitwidth: Save Param Bits from ItemStatCost.txt. */
  readonly saveParamBits: number
}

// Module-level default tables loaded for convenience
let defaultStatsTable: ItemStatCostTable | undefined
let defaultPropertiesTable: PropertiesTable | undefined

/**
 * Configure default ItemStatCost and Properties tables used by top-level resolveProperty().
 */
export function setDefaultItemPropertiesAndStats(tables: {
  stats?: ItemStatCostTable
  properties?: PropertiesTable
}): void {
  if (tables.stats) defaultStatsTable = tables.stats
  if (tables.properties) defaultPropertiesTable = tables.properties
}

/**
 * Retrieve the currently configured default tables.
 */
export function getDefaultItemPropertiesAndStats(): {
  stats?: ItemStatCostTable | undefined
  properties?: PropertiesTable | undefined
} {
  return { stats: defaultStatsTable, properties: defaultPropertiesTable }
}

/**
 * Helper to safely extract a trimmed cell from a D2Table row by exact or case-insensitive column name.
 */
function getCell(table: D2Table, row: readonly string[], colName: string): string {
  const exact = table.header.indexOf(colName)
  if (exact !== -1) return (row[exact] ?? '').trim()
  const lower = colName.toLowerCase()
  const foundIdx = table.header.findIndex(h => h.trim().toLowerCase() === lower)
  if (foundIdx !== -1) return (row[foundIdx] ?? '').trim()
  return ''
}

/**
 * Helper to parse a numeric cell from a D2Table row.
 */
function getNum(table: D2Table, row: readonly string[], colName: string, fallback = 0): number {
  const text = getCell(table, row, colName)
  if (!text) return fallback
  const n = Number(text)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Helper to parse a boolean flag cell ('1' => true) from a D2Table row.
 */
function getBool(table: D2Table, row: readonly string[], colName: string): boolean {
  const text = getCell(table, row, colName)
  return text === '1' || text.toLowerCase() === 'true'
}

/**
 * Parse an ItemStatCost.txt D2Table into an ItemStatCostTable.
 *
 * Expects 359 rows with IDs 0..358.
 * NOTE: Uses 'Save Bits' and 'Save Add', NOT '1.09-Save Bits' or '1.09-Save Add'.
 */
export function parseItemStatCostTable(table: D2Table): ItemStatCostTable {
  const records: ItemStatCostRecord[] = []
  const byStat = new Map<string, ItemStatCostRecord>()
  const byId = new Map<number, ItemStatCostRecord>()

  for (const raw of table.rows) {
    const stat = getCell(table, raw, 'Stat')
    if (!stat) continue

    const id = getNum(table, raw, 'ID', -1)
    const signed = getBool(table, raw, 'Signed')
    const sendBits = getNum(table, raw, 'Send Bits')
    const sendParamBits = getNum(table, raw, 'Send Param Bits')
    const saved = getBool(table, raw, 'Saved')

    // CRITICAL: Use 'Save Bits' / 'Save Add' (exact column lookup), NOT '1.09-Save Bits'
    const saveBits = getNum(table, raw, 'Save Bits')
    const saveAdd = getNum(table, raw, 'Save Add')
    const saveParamBits = getNum(table, raw, 'Save Param Bits')

    const op = getNum(table, raw, 'op')
    const opParam = getNum(table, raw, 'op param')
    const opBase = getCell(table, raw, 'op base')
    const opStat1 = getCell(table, raw, 'op stat1')
    const opStat2 = getCell(table, raw, 'op stat2')
    const opStat3 = getCell(table, raw, 'op stat3')

    const descPriority = getNum(table, raw, 'descpriority')
    const descFunc = getNum(table, raw, 'descfunc')
    const descVal = getNum(table, raw, 'descval')
    const descStrPos = getCell(table, raw, 'descstrpos')
    const descStrNeg = getCell(table, raw, 'descstrneg')
    const descStr2 = getCell(table, raw, 'descstr2')

    const dgrp = getNum(table, raw, 'dgrp')
    const dgrpFunc = getNum(table, raw, 'dgrpfunc')
    const dgrpVal = getNum(table, raw, 'dgrpval')
    const dgrpStrPos = getCell(table, raw, 'dgrpstrpos')
    const dgrpStrNeg = getCell(table, raw, 'dgrpstrneg')
    const dgrpStr2 = getCell(table, raw, 'dgrpstr2')

    const valShift = getNum(table, raw, 'ValShift')
    const encode = getNum(table, raw, 'Encode')
    const divide = getNum(table, raw, 'Divide')
    const multiply = getNum(table, raw, 'Multiply')
    const add = getNum(table, raw, 'Add')

    const record: ItemStatCostRecord = {
      Stat: stat,
      stat,
      id,
      signed,
      sendBits,
      sendParamBits,
      saved,
      saveBits,
      saveAdd,
      saveParamBits,
      op,
      opParam,
      opBase,
      opStat1,
      opStat2,
      opStat3,
      descPriority,
      descFunc,
      descVal,
      descStrPos,
      descStrNeg,
      descStr2,
      dgrp,
      dgrpFunc,
      dgrpVal,
      dgrpStrPos,
      dgrpStrNeg,
      dgrpStr2,
      valShift,
      encode,
      divide,
      multiply,
      add,
    }

    records.push(record)
    byStat.set(stat, record)
    if (id >= 0) {
      byId.set(id, record)
    }
  }

  const result: ItemStatCostTable = {
    table,
    records,
    rows: records,
    byStat,
    byId,
    get(statOrId: string | number): ItemStatCostRecord | undefined {
      if (typeof statOrId === 'number') {
        return byId.get(statOrId)
      }
      return byStat.get(statOrId)
    },
    getByStat(stat: string): ItemStatCostRecord | undefined {
      return byStat.get(stat)
    },
    getById(id: number): ItemStatCostRecord | undefined {
      return byId.get(id)
    },
  }

  return result
}

/**
 * Parse a Properties.txt D2Table into a PropertiesTable.
 *
 * Filters out comment columns starting with '*' and the 'Expansion' separator row.
 * Produces exactly 268 records from the canonical 269-row table.
 */
export function parsePropertiesTable(
  table: D2Table,
  statsTable?: ItemStatCostTable
): PropertiesTable {
  const records: PropertyRecord[] = []
  const byCode = new Map<string, PropertyRecord>()

  for (const raw of table.rows) {
    const code = getCell(table, raw, 'code')
    // Filter empty rows and the 'Expansion' separator row
    if (!code || code === 'Expansion') continue

    const set1 = getNum(table, raw, 'set1')
    const val1 = getNum(table, raw, 'val1')
    const func1 = getNum(table, raw, 'func1')
    const stat1 = getCell(table, raw, 'stat1')

    const set2 = getNum(table, raw, 'set2')
    const val2 = getNum(table, raw, 'val2')
    const func2 = getNum(table, raw, 'func2')
    const stat2 = getCell(table, raw, 'stat2')

    const set3 = getNum(table, raw, 'set3')
    const val3 = getNum(table, raw, 'val3')
    const func3 = getNum(table, raw, 'func3')
    const stat3 = getCell(table, raw, 'stat3')

    const set4 = getNum(table, raw, 'set4')
    const val4 = getNum(table, raw, 'val4')
    const func4 = getNum(table, raw, 'func4')
    const stat4 = getCell(table, raw, 'stat4')

    const set5 = getNum(table, raw, 'set5')
    const val5 = getNum(table, raw, 'val5')
    const func5 = getNum(table, raw, 'func5')
    const stat5 = getCell(table, raw, 'stat5')

    const set6 = getNum(table, raw, 'set6')
    const val6 = getNum(table, raw, 'val6')
    const func6 = getNum(table, raw, 'func6')
    const stat6 = getCell(table, raw, 'stat6')

    const set7 = getNum(table, raw, 'set7')
    const val7 = getNum(table, raw, 'val7')
    const func7 = getNum(table, raw, 'func7')
    const stat7 = getCell(table, raw, 'stat7')

    const rawSlots: [number, number, number, string][] = [
      [set1, val1, func1, stat1],
      [set2, val2, func2, stat2],
      [set3, val3, func3, stat3],
      [set4, val4, func4, stat4],
      [set5, val5, func5, stat5],
      [set6, val6, func6, stat6],
      [set7, val7, func7, stat7],
    ]

    const stats: PropertyStatEntry[] = []
    rawSlots.forEach(([set, val, func, stat], idx) => {
      if (func > 0 || stat !== '' || set !== 0 || val !== 0) {
        stats.push({
          index: idx + 1,
          set,
          val,
          func,
          stat,
        })
      }
    })

    const record: PropertyRecord = {
      code,
      stats,
      set1,
      val1,
      func1,
      stat1,
      set2,
      val2,
      func2,
      stat2,
      set3,
      val3,
      func3,
      stat3,
      set4,
      val4,
      func4,
      stat4,
      set5,
      val5,
      func5,
      stat5,
      set6,
      val6,
      func6,
      stat6,
      set7,
      val7,
      func7,
      stat7,
    }

    records.push(record)
    byCode.set(code, record)
  }

  let linkedStats = statsTable

  const result: PropertiesTable = {
    table,
    records,
    rows: records,
    byCode,
    get(code: string): PropertyRecord | undefined {
      return byCode.get(code)
    },
    getByCode(code: string): PropertyRecord | undefined {
      return byCode.get(code)
    },
    resolveProperty(
      propCode: string,
      param?: number,
      min?: number,
      max?: number,
      overrideStats?: ItemStatCostTable
    ): ResolvedStat[] {
      return resolveProperty(propCode, param, min, max, {
        properties: result,
        stats: overrideStats ?? linkedStats ?? defaultStatsTable,
      })
    },
  }

  return result
}

/**
 * Load both ItemStatCost.txt and Properties.txt from mounted MPQ archives.
 */
export async function loadItemPropertiesAndStats(
  archives: MountedArchives
): Promise<{ stats: ItemStatCostTable; itemStatCost: ItemStatCostTable; properties: PropertiesTable }> {
  const statsRaw = await archives.read(ITEM_STAT_COST_PATH)
  const stats = parseItemStatCostTable(parseTable(statsRaw))

  const propertiesRaw = await archives.read(PROPERTIES_PATH)
  const properties = parsePropertiesTable(parseTable(propertiesRaw), stats)

  setDefaultItemPropertiesAndStats({ stats, properties })
  return { stats, itemStatCost: stats, properties }
}

/**
 * Context or options for resolveProperty.
 */
export interface PropertyResolutionContext {
  readonly properties?: PropertiesTable | undefined
  readonly stats?: ItemStatCostTable | undefined
  readonly value?: number | undefined
}

/**
 * Resolve a property code into concrete stat modifications with resolved stat ID, function, min, max, value.
 *
 * Handles standard property function mapping:
 * - Func 1, 2, 8, 13, 14: standard stat bonuses
 * - Func 3, 9: range inheritance from preceding slot (e.g. 'all-stats', 'res-all')
 * - Func 5, 6, 7: damage min/max/percent
 * - Func 10: skill tab bonuses
 * - Func 11: chance to cast skills
 * - Func 15: use min field only (e.g. dmg-cold min)
 * - Func 16: use max field only (e.g. dmg-cold max)
 * - Func 17: use param field only (e.g. dmg-cold length)
 * - Func 20: indestructible
 * - Func 21, 36: class skills
 * - Func 22: individual skill / aura / oskill
 *
 * @param propCode - property code (e.g. 'ac', 'str', 'dmg-cold', 'all-stats')
 * @param param - optional property parameter (e.g. skill ID, duration frames)
 * @param min - optional minimum roll
 * @param max - optional maximum roll
 * @param context - optional table overrides or context
 * @returns array of resolved stat modifications
 */
export function resolveProperty(
  propCode: string,
  param?: number,
  min?: number,
  max?: number,
  context?: PropertyResolutionContext | PropertiesTable
): ResolvedStat[] {
  let propTable: PropertiesTable | undefined
  let statTable: ItemStatCostTable | undefined
  let customValue: number | undefined

  if (context) {
    if ('byCode' in context) {
      propTable = context
    } else {
      propTable = context.properties
      statTable = context.stats
      customValue = context.value
    }
  }

  propTable = propTable ?? defaultPropertiesTable
  statTable = statTable ?? defaultStatsTable

  if (!propTable) {
    throw new Error(
      `resolveProperty: Properties table is not available. Call loadItemPropertiesAndStats() first or pass tables in context.`
    )
  }

  const prop = propTable.getByCode(propCode)
  if (!prop) {
    return []
  }

  const results: ResolvedStat[] = []
  let previousResolved: { min: number; max: number; value: number; param?: number | undefined } | null = null

  for (const entry of prop.stats) {
    const func = entry.func
    let statName = entry.stat
    let resolvedMin = min ?? 0
    let resolvedMax = max ?? min ?? 0
    let resolvedVal =
      customValue !== undefined
        ? customValue
        : min !== undefined
          ? min
          : max !== undefined
            ? max
            : 0
    let resolvedParam = param

    switch (func) {
      case 1:
      case 2:
      case 8:
      case 13:
      case 14:
        if (entry.set !== 0 && resolvedParam === undefined) {
          resolvedParam = entry.set
        }
        break

      case 3:
      case 9:
        // Inherit range from previous slot in the same property (e.g. all-stats, res-all)
        if (previousResolved) {
          resolvedMin = previousResolved.min
          resolvedMax = previousResolved.max
          resolvedVal = previousResolved.value
          if (func === 9 || resolvedParam === undefined) {
            resolvedParam = previousResolved.param
          }
        }
        break

      case 5:
        // dmg-min
        if (!statName) statName = 'mindamage'
        break

      case 6:
        // dmg-max
        if (!statName) statName = 'maxdamage'
        break

      case 7:
        // dmg%
        if (!statName) statName = 'item_maxdamage_percent'
        break

      case 10:
        // skilltab bonus: D2Common 0x6fd98470 stores par (class*3+tab) as stat param `par % 3 + 8 * (par / 3)`.
        if (!statName) statName = 'item_addskill_tab'
        if (resolvedParam === undefined && entry.val !== 0) {
          resolvedParam = entry.val
        }
        if (resolvedParam !== undefined) resolvedParam = encodeSkillTabParam(resolvedParam)
        break

      case 11:
        // Chance to cast skills (min = chance%, max = skill level)
        resolvedMin = min ?? 0
        resolvedMax = max ?? min ?? 0
        resolvedVal =
          customValue !== undefined
            ? customValue
            : min !== undefined
              ? min
              : max !== undefined
                ? max
                : 0
        resolvedParam = param
        break

      case 12:
        // Random class skill
        if (!statName) statName = 'item_singleskill'
        resolvedParam = param
        break

      case 15:
        // Use min field only (e.g. coldmindam)
        resolvedMin = min ?? 0
        resolvedMax = min ?? 0
        resolvedVal = customValue !== undefined ? customValue : (min ?? 0)
        resolvedParam = param
        break

      case 16:
        // Use max field only (e.g. coldmaxdam)
        resolvedMin = max ?? min ?? 0
        resolvedMax = max ?? min ?? 0
        resolvedVal = customValue !== undefined ? customValue : (max ?? min ?? 0)
        resolvedParam = param
        break

      case 17:
        // Use param field only (e.g. coldlength)
        resolvedMin = param ?? 0
        resolvedMax = param ?? 0
        resolvedVal = customValue !== undefined ? customValue : (param ?? 0)
        resolvedParam = param
        break

      case 18:
        // /time property
        resolvedParam = param
        break

      case 19:
        // Charged skill
        if (!statName) statName = 'item_charged_skill'
        resolvedParam = param
        break

      case 20:
        // Indestructible
        if (!statName) statName = 'item_indesctructible'
        resolvedMin = 1
        resolvedMax = 1
        resolvedVal = 1
        break

      case 21:
      case 36:
        // Class skills (param = class ID from val)
        if (!statName) statName = 'item_addclassskills'
        resolvedParam = entry.val
        break

      case 22:
        // Individual skill / aura / oskill (param = skill ID)
        resolvedParam = param
        break

      case 23:
        // Ethereal
        break

      case 24:
        // Monster-specific bonus
        resolvedParam = param
        break

      default:
        if (entry.set !== 0 && resolvedParam === undefined) {
          resolvedParam = entry.set
        }
        break
    }

    // Lookup stat metadata from ItemStatCostTable
    let statId = -1
    let saveBits = 0
    let saveAdd = 0
    let saveParamBits = 0

    if (statTable && statName) {
      const statRecord = statTable.getByStat(statName)
      if (statRecord) {
        statId = statRecord.id
        saveBits = statRecord.saveBits
        saveAdd = statRecord.saveAdd
        saveParamBits = statRecord.saveParamBits
      }
    }

    const resolved: ResolvedStat = {
      stat: statName,
      statId,
      id: statId,
      func,
      min: resolvedMin,
      max: resolvedMax,
      value: resolvedVal,
      param: resolvedParam,
      saveBits,
      saveAdd,
      saveParamBits,
    }

    results.push(resolved)
    previousResolved = {
      min: resolvedMin,
      max: resolvedMax,
      value: resolvedVal,
      param: resolvedParam,
    }
  }

  return results
}
