/**
 * Embedded Diablo II 1.13c Drop Tables Provider.
 *
 * Provides a self-contained, zero-network, zero-MPQ implementation of DropTables
 * using the canonical embedded 1.13c Blizzard data tables.
 * This guarantees instantaneous load times across any static HTTP server (e.g. port 8080,
 * file protocol, or headless production environments) without partial Range request failures.
 */

import {
  RAW_TC_EX,
  RAW_WEAPONS,
  RAW_ARMOR,
  RAW_MISC,
  RAW_ITEM_RATIO,
  RAW_ITEM_TYPES,
  RAW_UNIQUE_ITEMS,
  RAW_SET_ITEMS,
  RAW_SETS,
  RAW_MAGIC_PREFIX,
  RAW_MAGIC_SUFFIX,
  RAW_RARE_PREFIX,
  RAW_RARE_SUFFIX,
  RAW_MONSTATS,
  RAW_SUPERUNIQUES,
  RAW_DIFFICULTY_LEVELS,
} from '../data/canonical-drop-data.ts'
import {
  RAW_NPC,
  RAW_GAMBLE,
  RAW_BOOKS,
  RAW_LOW_QUALITY_ITEMS,
  RAW_ITEM_STAT_COST,
  RAW_PROPERTIES,
  CANONICAL_SKILL_COSTS,
} from '../data/canonical-vendor-data.ts'
import { parseTable } from '../world/acts.ts'
import { parseTreasureClassTable, type TreasureClassNode } from './treasure-class.ts'
import { parseWeaponsTable } from './weapons.ts'
import { parseArmorTable } from './armor.ts'
import { parseMiscTable } from './misc-items.ts'
import { parseItemRatioTable } from './item-ratio.ts'
import { parseUniqueItemsTable } from './unique-items.ts'
import { parseSetItemsTable, parseSetsTable } from './set-items.ts'
import { parseMagicAffixesTable } from './affixes.ts'
import { parseRareNamesTable } from './rare-names.ts'
import { parseItemTypesTable, isA } from './item-types.ts'
import { generateAutoTreasureClasses, autoTcToTreasureClassNode } from './auto-tc.ts'
import { parseDifficultyLevelsTable } from './item-upgrade.ts'
import type { DropTables } from './drop-tables.ts'
import type { ItemBase } from './items.ts'
import { CANONICAL_AUTOMAGIC_TABLE } from './automagic.ts'
import { readMonsterKinds, readSuperUniques, type SuperUnique } from '../units/monsters-data.ts'
import {
  parseItemStatCostTable,
  parsePropertiesTable,
  setDefaultItemPropertiesAndStats,
} from './properties.ts'
import { setRuntimePropertyTables } from './item-tooltip.ts'
import {
  parseNpcTable,
  parseGambleTable,
  parseBooksTable,
  parseLowQualityTable,
  buildSkillCostMap,
} from '../units/npc-table.ts'

let _cachedDropTables: DropTables | null = null

/**
 * Returns the fully-initialized, canonical 1.13c DropTables.
 * Initialized synchronously on first call (< 120ms) and memoized for all subsequent calls.
 */
export function getEmbeddedDropTables(): DropTables {
  if (_cachedDropTables) {
    return _cachedDropTables
  }

  const enc = new TextEncoder()
  const tcTable = parseTreasureClassTable(parseTable(enc.encode(RAW_TC_EX)))
  const weapons = parseWeaponsTable(parseTable(enc.encode(RAW_WEAPONS)))
  const armor = parseArmorTable(parseTable(enc.encode(RAW_ARMOR)))
  const misc = parseMiscTable(parseTable(enc.encode(RAW_MISC)))
  const itemRatio = parseItemRatioTable(parseTable(enc.encode(RAW_ITEM_RATIO)))
  const itemTypes = parseItemTypesTable(parseTable(enc.encode(RAW_ITEM_TYPES)))
  const uniques = parseUniqueItemsTable(parseTable(enc.encode(RAW_UNIQUE_ITEMS)))
  const setItemsTable = parseSetItemsTable(parseTable(enc.encode(RAW_SET_ITEMS)))
  const sets = {
    items: setItemsTable,
    sets: parseSetsTable(parseTable(enc.encode(RAW_SETS)), setItemsTable),
  }
  const magicAffixes = {
    prefixes: parseMagicAffixesTable(parseTable(enc.encode(RAW_MAGIC_PREFIX)), true),
    suffixes: parseMagicAffixesTable(parseTable(enc.encode(RAW_MAGIC_SUFFIX)), false),
  }
  const rareNames = {
    prefixes: parseRareNamesTable(parseTable(enc.encode(RAW_RARE_PREFIX))),
    suffixes: parseRareNamesTable(parseTable(enc.encode(RAW_RARE_SUFFIX))),
  }

  const rawAuto = generateAutoTreasureClasses(itemTypes, armor, weapons)
  const autoTcTable = new Map<string, TreasureClassNode>()
  for (const [k, v] of rawAuto) {
    autoTcTable.set(k, autoTcToTreasureClassNode(v))
  }

  const isAPredicate = (type: string, target: string): boolean => isA(type, target, itemTypes)
  const getBase = (code: string): ItemBase | undefined => weapons.get(code) ?? armor.get(code) ?? misc.get(code)

  const diffTable = parseTable(enc.encode(RAW_DIFFICULTY_LEVELS))
  const difficultyLevels = parseDifficultyLevelsTable(diffTable)
  const difficultyOdds = difficultyLevels.byName

  const monTable = parseTable(enc.encode(RAW_MONSTATS))
  const monsterKinds = readMonsterKinds(monTable)

  const suTable = parseTable(enc.encode(RAW_SUPERUNIQUES))
  const suList = readSuperUniques(suTable)
  const superUniques = new Map<string, SuperUnique>()
  for (const su of suList) {
    superUniques.set(su.id, su)
  }

  const itemStatCost = parseItemStatCostTable(parseTable(enc.encode(RAW_ITEM_STAT_COST)))
  const properties = parsePropertiesTable(parseTable(enc.encode(RAW_PROPERTIES)))
  setDefaultItemPropertiesAndStats({ stats: itemStatCost, properties })
  setRuntimePropertyTables(properties, itemStatCost)

  const npcTable = parseNpcTable(RAW_NPC)
  const gambleCodes = parseGambleTable(RAW_GAMBLE)
  const booksTable = parseBooksTable(RAW_BOOKS)
  const lowQualityItems = parseLowQualityTable(RAW_LOW_QUALITY_ITEMS)
  const skillCosts = buildSkillCostMap(CANONICAL_SKILL_COSTS)

  _cachedDropTables = {
    tcTable,
    autoTcTable,
    weapons,
    armor,
    misc,
    itemRatio,
    difficultyLevels,
    difficultyOdds,
    uniques,
    sets,
    magicAffixes,
    rareNames,
    autoMagic: CANONICAL_AUTOMAGIC_TABLE,
    properties,
    itemStatCost,
    npcTable,
    gambleCodes,
    booksTable,
    lowQualityItems,
    skillCosts,
    itemTypes,
    monsterKinds,
    superUniques,
    isA: isAPredicate,
    getBase,
  }

  return _cachedDropTables!
}

