/**
 * Rare and crafted item name tables (`RarePrefix.txt` and `RareSuffix.txt`).
 *
 * In Diablo II, rare and crafted items derive their names from a combination of
 * one prefix (rare name 1) and one suffix (rare name 2) chosen from these tables.
 * Character save files (.d2s) store these two names as 8-bit unsigned integers
 * (0..255), which directly index the rows of `RarePrefix.txt` and `RareSuffix.txt`
 * in 0-based order.
 *
 * Unlike `MagicPrefix.txt` and `MagicSuffix.txt`, rare prefix and suffix tables
 * DO NOT provide stat modifiers; they only provide the generated names and their
 * item-type eligibility criteria (`itype1..7` and `etype1..4`).
 *
 * If all `itype1..7` fields are empty, the entry is a WILDCARD that can spawn on
 * any item type (for example, 'Warp' and 'Rift'). If any `etype1..4` match the item's
 * type, the entry is excluded.
 */
import type { MountedArchives } from '../mpq/mount.ts'
import { parseTable, cell } from '../world/acts.ts'
import type { D2Table } from '../world/acts.ts'

/** Archive path for rare prefixes. */
export const RARE_PREFIX_TABLE_PATH = 'data\\global\\excel\\RarePrefix.txt'

/** Archive path for rare suffixes. */
export const RARE_SUFFIX_TABLE_PATH = 'data\\global\\excel\\RareSuffix.txt'

/**
 * One parsed entry from `RarePrefix.txt` or `RareSuffix.txt`.
 */
export interface RareNameEntry {
  /** 0-based index in the table, matching the 8-bit .d2s rare name index (0..255). */
  readonly index: number
  /** Name string key / display name. */
  readonly name: string
  /** Version: 0 for Classic, 100 for Expansion. */
  readonly version: number
  /** Allowed item types (`itype1..7`). Empty array indicates a wildcard matching any item. */
  readonly itypes: readonly string[]
  /** Excluded item types (`etype1..4`). */
  readonly etypes: readonly string[]
  /** Cost modifier: add. */
  readonly add: number
  /** Cost modifier: multiply. */
  readonly multiply: number
  /** Cost modifier: divide. */
  readonly divide: number
}

/**
 * A parsed rare names table with lookup and filtering methods.
 */
export interface RareNameTable {
  /** The underlying raw D2Table. */
  readonly table: D2Table
  /** All parsed entries preserving 0-indexed table order. */
  readonly entries: readonly RareNameEntry[]
  /** Number of entries in this table. */
  readonly length: number
  /** Lookup entry by 0-based index. */
  readonly byIndex: (index: number) => RareNameEntry | undefined
  /** Lookup entry by name (case-insensitive, first match). */
  readonly byName: (name: string) => RareNameEntry | undefined
  /** Filter entries eligible for given item type code. */
  readonly getEligible: (
    itemTypeCode: string,
    isA: (type: string, target: string) => boolean,
  ) => readonly RareNameEntry[]
  /** Allow iteration over entries. */
  [Symbol.iterator](): IterableIterator<RareNameEntry>
}

/**
 * Test whether a rare name entry is eligible for an item type.
 *
 * Rules:
 * - If itemTypeCode matches any `etypes` (via `isA(itemTypeCode, etype)`), it is excluded -> false.
 * - If `itypes` is empty, it is a WILDCARD -> true.
 * - Otherwise, it must match at least one `itype` (via `isA(itemTypeCode, itype)`) -> boolean.
 *
 * @param entry - The rare prefix or suffix entry.
 * @param itemTypeCode - The 3-4 letter item type code (e.g. 'ring', 'swor').
 * @param isA - Item type inheritance tester: `(type, target) => boolean`.
 *              Defaults to case-insensitive equality if not specified.
 * @returns true if the item type is eligible to roll this name.
 */
export function isRareNameEligible(
  entry: RareNameEntry,
  itemTypeCode: string,
  isA: (type: string, target: string) => boolean = (type, target) =>
    type.toLowerCase() === target.toLowerCase(),
): boolean {
  if (entry.etypes.some(etype => isA(itemTypeCode, etype))) {
    return false
  }
  if (entry.itypes.length === 0) {
    return true
  }
  return entry.itypes.some(itype => isA(itemTypeCode, itype))
}

/**
 * Read a column from a D2Table row with case-insensitive column matching fallback.
 */
function getCell(table: D2Table, row: readonly string[], column: string): string {
  const direct = cell(table, row, column)
  if (direct !== '') return direct
  const lower = column.toLowerCase()
  const idx = table.header.findIndex(h => h.toLowerCase() === lower)
  return idx === -1 ? '' : (row[idx] ?? '')
}

/**
 * Parse a D2Table into a RareNameTable.
 *
 * Preserves 0-indexed row order matching .d2s index values.
 *
 * @param table - Raw parsed D2Table.
 * @returns Parsed RareNameTable.
 */
export function parseRareNamesTable(table: D2Table): RareNameTable {
  const entries: RareNameEntry[] = []
  const nameMap = new Map<string, RareNameEntry>()

  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i]!
    const name = getCell(table, row, 'name').trim()
    const version = Number(getCell(table, row, 'version').trim()) || 0

    const itypes: string[] = []
    for (let slot = 1; slot <= 7; slot++) {
      const itype = getCell(table, row, `itype${slot}`).trim()
      if (itype !== '') {
        itypes.push(itype)
      }
    }

    const etypes: string[] = []
    for (let slot = 1; slot <= 4; slot++) {
      const etype = getCell(table, row, `etype${slot}`).trim()
      if (etype !== '') {
        etypes.push(etype)
      }
    }

    const add = Number(getCell(table, row, 'add').trim()) || 0
    const multiply = Number(getCell(table, row, 'multiply').trim()) || 0
    const divide = Number(getCell(table, row, 'divide').trim()) || 0

    const entry: RareNameEntry = {
      index: i,
      name,
      version,
      itypes,
      etypes,
      add,
      multiply,
      divide,
    }

    entries.push(entry)
    const lower = name.toLowerCase()
    if (!nameMap.has(lower)) {
      nameMap.set(lower, entry)
    }
  }

  const byIndex = (index: number): RareNameEntry | undefined => entries[index]
  const byName = (name: string): RareNameEntry | undefined => nameMap.get(name.toLowerCase())
  const getEligible = (
    itemTypeCode: string,
    isA: (type: string, target: string) => boolean,
  ): readonly RareNameEntry[] => {
    return entries.filter(entry => isRareNameEligible(entry, itemTypeCode, isA))
  }

  return {
    table,
    entries,
    length: entries.length,
    byIndex,
    byName,
    getEligible,
    [Symbol.iterator](): IterableIterator<RareNameEntry> {
      return entries[Symbol.iterator]()
    },
  }
}

/**
 * Load and parse both RarePrefix.txt and RareSuffix.txt from mounted MPQ archives.
 *
 * @param archives - Mounted MPQ archives.
 * @returns Object containing parsed prefixes and suffixes tables.
 */
export async function loadRareNames(
  archives: MountedArchives,
): Promise<{ prefixes: RareNameTable; suffixes: RareNameTable }> {
  const prefixTable = parseTable(await archives.read(RARE_PREFIX_TABLE_PATH))
  const suffixTable = parseTable(await archives.read(RARE_SUFFIX_TABLE_PATH))
  return {
    prefixes: parseRareNamesTable(prefixTable),
    suffixes: parseRareNamesTable(suffixTable),
  }
}

/** Canonical RarePrefix TSV extracted from 1.13c game data (d2exp.mpq). */
export const CANONICAL_RARE_PREFIX_TSV = "name\tversion\titype1\titype2\titype3\titype4\titype5\titype6\titype7\tetype1\tetype2\tetype3\tetype4\tadd\tmultiply\tdivide\nBeast\t0\tarmo\tweap\tmisc\t\t\t\t\t\t\t\t\t0\t0\t0\nEagle\t0\tarmo\tweap\tmisc\t\t\t\t\t\t\t\t\t0\t0\t0\nRaven\t0\tarmo\tweap\tmisc\t\t\t\t\t\t\t\t\t0\t0\t0\nViper\t0\tarmo\tweap\tmisc\t\t\t\t\t\t\t\t\t0\t0\t0\nGhoulRI\t0\tarmo\tweap\tmisc\t\t\t\t\t\t\t\t\t0\t0\t0\nSkull\t0\tarmo\tweap\tmisc\t\t\t\t\t\t\t\t\t0\t0\t0\nBlood\t0\tarmo\tweap\tmisc\t\t\t\t\t\t\t\t\t0\t0\t0\nDread\t0\tarmo\tweap\tmisc\t\t\t\t\t\t\t\t\t0\t0\t0\nDoom\t0\tarmo\tweap\tmisc\t\t\t\t\t\t\t\t\t0\t0\t0\nGrim\t0\tarmo\tweap\tmisc\t\t\t\t\t\t\t\t\t0\t0\t0\nBone\t0\tarmo\tweap\tmisc\t\t\t\t\t\t\t\t\t0\t0\t0\nDeath\t0\tarmo\tweap\tmisc\t\t\t\t\t\t\t\t\t0\t0\t0\nShadow\t0\tarmo\tweap\tmisc\t\t\t\t\t\t\t\t\t0\t0\t0\nStorm\t0\tarmo\tweap\tmisc\t\t\t\t\t\t\t\t\t0\t0\t0\nRune\t0\tarmo\tweap\tmisc\t\t\t\t\t\t\t\t\t0\t0\t0\nPlagueRI\t0\tarmo\tweap\tmisc\t\t\t\t\t\t\t\t\t0\t0\t0\nStone\t0\tarmo\tweap\tmisc\t\t\t\t\t\t\t\t\t0\t0\t0\nWraithra\t0\tarmo\tweap\tmisc\t\t\t\t\t\t\t\t\t0\t0\t0\nSpirit\t0\tarmo\trod\t\t\t\t\t\t\t\t\t\t0\t0\t0\nStorm\t0\tarmo\tweap\t\t\t\t\t\t\t\t\t\t0\t0\t0\nDemon\t0\tarmo\tweap\t\t\t\t\t\t\t\t\t\t0\t0\t0\nCruel\t0\tarmo\tweap\t\t\t\t\t\t\t\t\t\t0\t0\t0\nEmpyrion\t0\trod\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nBramble\t0\tarmo\tweap\t\t\t\t\t\t\t\t\t\t0\t0\t0\nPain\t0\tarmo\tweap\t\t\t\t\t\t\t\t\t\t0\t0\t0\nLoath\t0\tarmo\tweap\t\t\t\t\t\t\t\t\t\t0\t0\t0\nGlyph\t0\tarmo\tweap\t\t\t\t\t\t\t\t\t\t0\t0\t0\nImp\t0\tarmo\tweap\t\t\t\t\t\t\t\t\t\t0\t0\t0\nFiendra\t0\tarmo\tweap\t\t\t\t\t\t\t\t\t\t0\t0\t0\nHailstone\t0\tarmo\tweap\t\t\t\t\t\t\t\t\t\t0\t0\t0\nGale\t0\tarmo\tweap\t\t\t\t\t\t\t\t\t\t0\t0\t0\nDire\t0\tarmo\tweap\t\t\t\t\t\t\t\t\t\t0\t0\t0\nSoul\t0\tarmo\tweap\t\t\t\t\t\t\t\t\t\t0\t0\t0\nBrimstone\t0\tarmo\tweap\t\t\t\t\t\t\t\t\t\t0\t0\t0\nCorpse\t0\tarmo\tweap\t\t\t\t\t\t\t\t\t\t0\t0\t0\nCarrion\t0\tarmo\tweap\t\t\t\t\t\t\t\t\t\t0\t0\t0\nHolocaust\t0\ttors\thelm\tshld\tswor\taxe\t\t\t\t\t\t\t0\t0\t0\nHavoc\t0\tarmo\tweap\tmisc\t\t\t\t\t\t\t\t\t0\t0\t0\nBitter\t0\tarmo\tweap\tmisc\t\t\t\t\t\t\t\t\t0\t0\t0\nEntropy\t0\tring\tamul\t\t\t\t\t\t\t\t\t\t0\t0\t0\nChaos\t0\tring\tamul\t\t\t\t\t\t\t\t\t\t0\t0\t0\nOrder\t0\tring\tamul\tscep\t\t\t\t\t\t\t\t\t0\t0\t0\nRule\t0\trod\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nWarp\t0\t\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nRift\t0\t\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nCorruption\t0\tring\tamul\t\t\t\t\t\t\t\t\t\t0\t0\t0"

/** Canonical RareSuffix TSV extracted from 1.13c game data (d2exp.mpq). */
export const CANONICAL_RARE_SUFFIX_TSV = "name\tversion\titype1\titype2\titype3\titype4\titype5\titype6\titype7\tetype1\tetype2\tetype3\tetype4\tadd\tmultiply\tdivide\nbite\t0\tswor\tknif\tspea\tpole\taxe\th2h\t\t\t\t\t\t0\t0\t0\nscratch\t0\tswor\tknif\tspea\tpole\th2h\t\t\t\t\t\t\t0\t0\t0\nscalpel\t0\tswor\tknif\t\t\t\t\t\t\t\t\t\t0\t0\t0\nfang\t0\tswor\tknif\tspea\tpole\t\t\t\t\t\t\t\t0\t0\t0\ngutter\t0\tswor\tknif\tspea\tpole\t\t\t\t\t\t\t\t0\t0\t0\nthirst\t0\tswor\tknif\tspea\tpole\taxe\th2h\t\t\t\t\t\t0\t0\t0\nrazor\t0\tswor\tknif\taxe\th2h\t\t\t\t\t\t\t\t0\t0\t0\nscythe\t0\tswor\taxe\tpole\t\t\t\t\t\t\t\t\t0\t0\t0\nedge\t0\tswor\tknif\taxe\t\t\t\t\t\t\t\t\t0\t0\t0\nsaw\t0\tswor\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nsplitter\t0\taxe\tmace\tclub\thamm\t\t\t\t\t\t\t\t0\t0\t0\ncleaver\t0\tswor\taxe\t\t\t\t\t\t\t\t\t\t0\t0\t0\nsever\t0\tswor\taxe\t\t\t\t\t\t\t\t\t\t0\t0\t0\nsunder\t0\taxe\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nrend\t0\taxe\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nmangler\t0\taxe\tmace\tclub\thamm\t\t\t\t\t\t\t\t0\t0\t0\nslayer\t0\taxe\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nreaver\t0\taxe\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nspawn\t0\taxe\thamm\t\t\t\t\t\t\t\t\t\t0\t0\t0\ngnash\t0\taxe\tclub\thamm\t\t\t\t\t\t\t\t\t0\t0\t0\nstar\t0\tmace\thamm\tscep\twand\t\t\t\t\t\t\t\t0\t0\t0\nblow\t0\tmace\tclub\thamm\tscep\t\t\t\t\t\t\t\t0\t0\t0\nsmasher\t0\tmace\tclub\thamm\tscep\t\t\t\t\t\t\t\t0\t0\t0\nBane\t0\tmace\tscep\twand\t\t\t\t\t\t\t\t\t0\t0\t0\ncrusher\t0\tmace\tclub\thamm\tscep\t\t\t\t\t\t\t\t0\t0\t0\nbreaker\t0\tmace\tclub\thamm\tscep\t\t\t\t\t\t\t\t0\t0\t0\ngrinder\t0\tmace\tclub\thamm\tscep\t\t\t\t\t\t\t\t0\t0\t0\ncrack\t0\tmace\tclub\thamm\tscep\twand\t\t\t\t\t\t\t0\t0\t0\nmallet\t0\thamm\tclub\t\t\t\t\t\t\t\t\t\t0\t0\t0\nknell\t0\tmace\tclub\tscep\twand\t\t\t\t\t\t\t\t0\t0\t0\nlance\t0\tspea\tpole\t\t\t\t\t\t\t\t\t\t0\t0\t0\nspike\t0\tswor\tknif\tspea\tpole\t\t\t\t\t\t\t\t0\t0\t0\nimpaler\t0\tswor\tknif\tspea\tpole\t\t\t\t\t\t\t\t0\t0\t0\nskewer\t0\tswor\tknif\tspea\t\t\t\t\t\t\t\t\t0\t0\t0\nprod\t0\tspea\tpole\t\t\t\t\t\t\t\t\t\t0\t0\t0\nscourge\t0\tspea\tpole\t\t\t\t\t\t\t\t\t\t0\t0\t0\nwand\t0\twand\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nwrack\t0\tspea\tpole\t\t\t\t\t\t\t\t\t\t0\t0\t0\nbarb\t0\tswor\tknif\taxe\tspea\tpole\th2h\t\t\t\t\t\t0\t0\t0\nneedle\t0\tswor\tknif\tspea\tmiss\t\t\t\t\t\t\t\t0\t0\t0\ndart\t0\tspea\tmiss\t\t\t\t\t\t\t\t\t\t0\t0\t0\nbolt\t0\tmiss\tjave\t\t\t\t\t\t\t\t\t\t0\t0\t0\nquarrel\t0\tmiss\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nfletch\t0\tmiss\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nflight\t0\tmiss\tjave\t\t\t\t\t\t\t\t\t\t0\t0\t0\nnock\t0\tmiss\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nhorn\t0\thelm\tmiss\tknif\t\t\t\t\t\t\t\t\t0\t0\t0\nstinger\t0\tswor\tknif\tspea\tmiss\t\t\t\t\t\t\t\t0\t0\t0\nquill\t0\tknif\tmiss\t\t\t\t\t\t\t\t\t\t0\t0\t0\ngoad\t0\tspea\tpole\tstaf\t\t\t\t\t\t\t\t\t0\t0\t0\nbranch\t0\tspea\tstaf\tbow\t\t\t\t\t\t\t\t\t0\t0\t0\nspire\t0\tstaf\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nsong\t0\tweap\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\ncall\t0\trod\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\ncry\t0\trod\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nspell\t0\trod\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nchant\t0\trod\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nweaver\t0\trod\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\ngnarl\t0\tclub\twand\tstaf\t\t\t\t\t\t\t\t\t0\t0\t0\nvisage\t0\thelm\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\ncrest\t0\thelm\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\ncirclet\t0\thelm\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nveil\t0\thelm\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nhood\t0\thelm\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nmask\t0\thelm\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nbrow\t0\thelm\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\ncasque\t0\thelm\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nvisor\t0\thelm\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\ncowl\t0\thelm\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nhide\t0\ttors\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nPelt\t0\ttors\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\ncarapace\t0\ttors\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\ncoat\t0\ttors\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nwrap\t0\ttors\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nsuit\t0\ttors\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\ncloak\t0\ttors\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nshroud\t0\ttors\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\njack\t0\ttors\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nmantle\t0\ttors\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nguard\t0\tshld\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nbadge\t0\tshld\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nrock\t0\tshld\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\naegis\t0\tshld\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nward\t0\tshld\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\ntower\t0\tshld\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nshield\t0\tshld\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nwing\t0\tshld\tamul\t\t\t\t\t\t\t\t\t\t0\t0\t0\nmark\t0\tshld\tamul\t\t\t\t\t\t\t\t\t\t0\t0\t0\nemblem\t0\tshld\tamul\t\t\t\t\t\t\t\t\t\t0\t0\t0\nhand\t0\tglov\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nfist\t0\tglov\th2h\t\t\t\t\t\t\t\t\t\t0\t0\t0\nclaw\t0\tglov\th2h\t\t\t\t\t\t\t\t\t\t0\t0\t0\nclutches\t0\tglov\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\ngrip\t0\tglov\tring\t\t\t\t\t\t\t\t\t\t0\t0\t0\ngrasp\t0\tglov\tring\t\t\t\t\t\t\t\t\t\t0\t0\t0\nhold\t0\tglov\tring\t\t\t\t\t\t\t\t\t\t0\t0\t0\ntouch\t0\tglov\tring\t\t\t\t\t\t\t\t\t\t0\t0\t0\nfinger\t0\tglov\tring\t\t\t\t\t\t\t\t\t\t0\t0\t0\nknuckle\t0\tglov\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nshank\t0\tboot\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nspur\t0\tboot\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\ntread\t0\tboot\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nstalker\t0\tboot\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\ngreave\t0\tboot\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nblazer\t0\tboot\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nnails\t0\tboot\tspea\tpole\t\t\t\t\t\t\t\t\t0\t0\t0\ntrample\t0\tboot\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nBrogues\t0\tboot\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\ntrack\t0\tboot\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nslippers\t0\tboot\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nclasp\t0\tbelt\tamul\t\t\t\t\t\t\t\t\t\t1\t1\t1\nbuckle\t0\tbelt\t\t\t\t\t\t\t\t\t\t\t1\t1\t1\nharness\t0\tbelt\t\t\t\t\t\t\t\t\t\t\t1\t1\t1\nlock\t0\tbelt\t\t\t\t\t\t\t\t\t\t\t1\t1\t1\nfringe\t0\tbelt\t\t\t\t\t\t\t\t\t\t\t1\t1\t1\nwinding\t0\tbelt\t\t\t\t\t\t\t\t\t\t\t1\t1\t1\nchain\t0\tbelt\t\t\t\t\t\t\t\t\t\t\t1\t1\t1\nstrap\t0\tbelt\t\t\t\t\t\t\t\t\t\t\t1\t1\t1\nlash\t0\tbelt\t\t\t\t\t\t\t\t\t\t\t1\t1\t1\ncord\t0\tbelt\t\t\t\t\t\t\t\t\t\t\t1\t1\t1\nknot\t0\tring\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\ncircle\t0\tring\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nloop\t0\tring\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\neye\t0\tmisc\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nturn\t0\tring\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nspiral\t0\tring\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\ncoil\t0\tring\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\ngyre\t0\tring\torb\tjewl\t\t\t\t\t\t\t\t\t0\t0\t0\nband\t0\tring\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nwhorl\t0\tring\torb\tjewl\t\t\t\t\t\t\t\t\t0\t0\t0\ntalisman\t0\tamul\tjewl\t\t\t\t\t\t\t\t\t\t0\t0\t0\nheart\t0\tamul\torb\tjewl\t\t\t\t\t\t\t\t\t0\t0\t0\nnoose\t0\tamul\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nnecklace\t0\tamul\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\ncollar\t0\tamul\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nbeads\t0\tamul\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\ntorc\t0\tamul\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\ngorget\t0\tamul\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nscarab\t0\tamul\tjewl\t\t\t\t\t\t\t\t\t\t0\t0\t0\nwood\t0\tspea\tpole\twand\tstaf\t\t\t\t\t\t\t\t0\t0\t0\nbrand\t0\tblun\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nbludgeon\t0\tblun\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\ncudgel\t0\tclub\twand\t\t\t\t\t\t\t\t\t\t0\t0\t0\nloom\t0\tmiss\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nharp\t0\tmiss\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nmaster\t0\tring\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nbarRI\t0\tblun\tspea\tpole\t\t\t\t\t\t\t\t\t0\t0\t0\nhew\t0\tswor\tknif\taxe\t\t\t\t\t\t\t\t\t0\t0\t0\ncrook\t0\tstaf\t\t\t\t\t\t\t\t\t\t\t0\t0\t0\nmar\t0\tswor\tknif\tmace\tclub\thamm\tspea\t\t\t\t\t\t0\t0\t0\nshell\t0\ttors\thelm\tshld\t\t\t\t\t\t\t\t\t0\t0\t0\nstake\t0\tspea\tpole\t\t\t\t\t\t\t\t\t\t0\t0\t0\npicket\t0\tspea\tpole\t\t\t\t\t\t\t\t\t\t0\t0\t0\npale\t0\tspea\tpole\t\t\t\t\t\t\t\t\t\t0\t0\t0\nflange\t0\ttors\tmace\thamm\tscep\t\t\t\t\t\t\t\t0\t0\t0"

/** Canonical RarePrefix D2Table parsed from 1.13c game data. */
export const CANONICAL_RARE_PREFIXES_TABLE: D2Table = parseTable(
  new TextEncoder().encode(CANONICAL_RARE_PREFIX_TSV.trim()),
)

/** Canonical RareSuffix D2Table parsed from 1.13c game data. */
export const CANONICAL_RARE_SUFFIXES_TABLE: D2Table = parseTable(
  new TextEncoder().encode(CANONICAL_RARE_SUFFIX_TSV.trim()),
)

/** Canonical RarePrefix table with lookup and eligibility methods. */
export const CANONICAL_RARE_PREFIXES: RareNameTable = parseRareNamesTable(
  CANONICAL_RARE_PREFIXES_TABLE,
)

/** Canonical RareSuffix table with lookup and eligibility methods. */
export const CANONICAL_RARE_SUFFIXES: RareNameTable = parseRareNamesTable(
  CANONICAL_RARE_SUFFIXES_TABLE,
)

/**
 * Get all rare prefixes eligible for a given item type.
 *
 * Supports calling with `(typeCode, isA, table?)` or `(table, typeCode, isA)`.
 */
export function getEligibleRarePrefixes(
  typeCode: string,
  isA: (type: string, target: string) => boolean,
  table?: RareNameTable,
): readonly RareNameEntry[]
export function getEligibleRarePrefixes(
  table: RareNameTable,
  typeCode: string,
  isA: (type: string, target: string) => boolean,
): readonly RareNameEntry[]
export function getEligibleRarePrefixes(
  first: string | RareNameTable,
  second: ((type: string, target: string) => boolean) | string,
  third?: ((type: string, target: string) => boolean) | RareNameTable,
): readonly RareNameEntry[] {
  let table: RareNameTable
  let typeCode: string
  let isA: (type: string, target: string) => boolean

  if (typeof first === 'string') {
    typeCode = first
    isA = second as (type: string, target: string) => boolean
    table = (third as RareNameTable | undefined) ?? CANONICAL_RARE_PREFIXES
  } else {
    table = first
    typeCode = second as string
    isA = third as (type: string, target: string) => boolean
  }

  return table.getEligible(typeCode, isA)
}

/**
 * Get all rare suffixes eligible for a given item type.
 *
 * Supports calling with `(typeCode, isA, table?)` or `(table, typeCode, isA)`.
 */
export function getEligibleRareSuffixes(
  typeCode: string,
  isA: (type: string, target: string) => boolean,
  table?: RareNameTable,
): readonly RareNameEntry[]
export function getEligibleRareSuffixes(
  table: RareNameTable,
  typeCode: string,
  isA: (type: string, target: string) => boolean,
): readonly RareNameEntry[]
export function getEligibleRareSuffixes(
  first: string | RareNameTable,
  second: ((type: string, target: string) => boolean) | string,
  third?: ((type: string, target: string) => boolean) | RareNameTable,
): readonly RareNameEntry[] {
  let table: RareNameTable
  let typeCode: string
  let isA: (type: string, target: string) => boolean

  if (typeof first === 'string') {
    typeCode = first
    isA = second as (type: string, target: string) => boolean
    table = (third as RareNameTable | undefined) ?? CANONICAL_RARE_SUFFIXES
  } else {
    table = first
    typeCode = second as string
    isA = third as (type: string, target: string) => boolean
  }

  return table.getEligible(typeCode, isA)
}
