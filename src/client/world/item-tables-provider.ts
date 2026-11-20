/**
 * Canonical 1.13c ItemDataTables Provider (`src/client/world/item-tables-provider.ts`).
 *
 * Builds and caches `ItemDataTables` from the embedded 1.13c Excel tables
 * (`ItemStatCost.txt`, `Armor.txt`, `Weapons.txt`, `Misc.txt`) for injecting
 * into `D2gsSession` / `D2gsAdapter` / `D2OnlineFlow` / `decodeD2gsItemPacket`.
 */

import { RAW_ARMOR, RAW_MISC, RAW_WEAPONS } from '../../common/data/canonical-drop-data.ts'
import { RAW_ITEM_STAT_COST } from '../../common/data/canonical-vendor-data.ts'
import { parseTable, type D2Table } from '../../common/world/acts.ts'
import type { ItemBaseMeta, ItemDataTables, ItemStatCostMeta } from '../../netproto/index.ts'

function getCell(table: D2Table, row: readonly string[], colName: string): string {
  const exact = table.header.indexOf(colName)
  if (exact !== -1) return (row[exact] ?? '').trim()
  const lower = colName.toLowerCase()
  const foundIdx = table.header.findIndex(h => h.trim().toLowerCase() === lower)
  if (foundIdx !== -1) return (row[foundIdx] ?? '').trim()
  return ''
}

function getNum(table: D2Table, row: readonly string[], colName: string, fallback = 0): number {
  const text = getCell(table, row, colName)
  if (!text) return fallback
  const n = Number(text)
  return Number.isFinite(n) ? n : fallback
}

function getBool(table: D2Table, row: readonly string[], colName: string): boolean {
  const text = getCell(table, row, colName)
  return text === '1' || text.toLowerCase() === 'true'
}

function parseBaseTable(
  rawTsv: string,
  kind: 'armor' | 'weapon' | 'misc',
  enc: TextEncoder,
): Map<string, ItemBaseMeta> {
  const table = parseTable(enc.encode(rawTsv))
  const map = new Map<string, ItemBaseMeta>()
  for (const row of table.rows) {
    const name = getCell(table, row, 'name')
    if (!name || name.toLowerCase() === 'expansion') continue
    const code = getCell(table, row, 'code')
    if (!code) continue

    const stackable = getBool(table, row, 'stackable')
    const nodurability = kind === 'misc' ? true : getBool(table, row, 'nodurability')
    const durability = getNum(table, row, 'durability', 0)
    const hasDurability = kind !== 'misc' && !nodurability && durability > 0
    const invWidth = Math.max(1, getNum(table, row, 'invwidth', 1))
    const invHeight = Math.max(1, getNum(table, row, 'invheight', 1))
    const minDefense = kind === 'armor' ? getNum(table, row, 'minac', 0) : 0
    const type = getCell(table, row, 'type')
    const isTome = type === 'book' || code === 'tbk' || code === 'ibk'
    const isBodyPart = type === 'body'
    const isGold = code === 'gld'
    const quest = getNum(table, row, 'quest', 0) > 0
    const questDiffCheck = getBool(table, row, 'questdiffcheck')

    const meta: ItemBaseMeta = {
      code,
      kind,
      stackable,
      hasDurability,
      nodurability,
      invWidth,
      invHeight,
      minDefense,
      isTome,
      isBodyPart,
      isGold,
      quest,
      questDiffCheck,
    }
    map.set(code, meta)
    const padded = code.padEnd(4, ' ').slice(0, 4)
    if (!map.has(padded)) {
      map.set(padded, meta)
    }
  }
  return map
}

let cachedItemDataTables: ItemDataTables | null = null

export function createCanonicalItemDataTables(): ItemDataTables {
  const enc = new TextEncoder()
  const statTable = parseTable(enc.encode(RAW_ITEM_STAT_COST))
  const itemStatCost = new Map<number, ItemStatCostMeta>()

  for (const row of statTable.rows) {
    const stat = getCell(statTable, row, 'Stat')
    if (!stat || stat.toLowerCase() === 'expansion') continue
    const id = getNum(statTable, row, 'ID', -1)
    if (id < 0) continue

    // Must use exact 'Save Bits' / 'Save Add' columns (not '1.09-Save Bits')
    const saveBits = getNum(statTable, row, 'Save Bits', 0)
    const saveAdd = getNum(statTable, row, 'Save Add', 0)
    const saveParamBits = getNum(statTable, row, 'Save Param Bits', 0)
    const sendBits = getNum(statTable, row, 'Send Bits', 0)
    const sendParamBits = getNum(statTable, row, 'Send Param Bits', 0)
    const signed = getBool(statTable, row, 'Signed')
    const valShift = getNum(statTable, row, 'ValShift', 0)
    const encode = getNum(statTable, row, 'Encode', 0)

    itemStatCost.set(id, {
      id,
      name: stat,
      saveBits,
      saveAdd,
      saveParamBits,
      sendBits,
      sendParamBits,
      signed,
      valShift,
      encode,
    })
  }

  const armor = parseBaseTable(RAW_ARMOR, 'armor', enc)
  const weapons = parseBaseTable(RAW_WEAPONS, 'weapon', enc)
  const misc = parseBaseTable(RAW_MISC, 'misc', enc)

  const lookupBase = (code: string): ItemBaseMeta | undefined => {
    const trimmed = code.trim()
    return armor.get(trimmed) ?? weapons.get(trimmed) ?? misc.get(trimmed) ??
      armor.get(code) ?? weapons.get(code) ?? misc.get(code)
  }

  const lookupStat = (statId: number): ItemStatCostMeta | undefined => itemStatCost.get(statId)

  return {
    itemStatCost,
    armor,
    weapons,
    misc,
    getStatMeta: lookupStat,
    getStatCost: lookupStat,
    getItemBaseMeta: lookupBase,
    getItemMeta: lookupBase,
  }
}

export function getCanonicalItemDataTables(): ItemDataTables {
  if (!cachedItemDataTables) {
    cachedItemDataTables = createCanonicalItemDataTables()
  }
  return cachedItemDataTables
}
