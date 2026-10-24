/**
 * Diablo II gem and rune socketing loader and modifier dispatch (`Gems.txt`).
 *
 * Gold standard reference: 1.13c MPQ `data/global/excel/Gems.txt` and `ItemTypes.txt`.
 *
 * In Diablo II, socketable items (weapons, helms, body armor, and shields)
 * can have gems (35 types: 7 gemstones × 5 quality tiers) and runes (33 runes:
 * El (r01) to Zod (r33)) socketed into them.
 *
 * Key data and game mechanics:
 * 1. `Gems.txt`:
 *    - 69 raw lines in 1.13c; minus the 'Expansion' section separator row = exactly 68 data rows × 41 columns.
 *    - 35 gems (indices 0..34) + 33 runes (indices 36..68, row 35 is 'Expansion').
 *    - Columns: `name`, `letter`, `transform`, `code`, `nummods`,
 *      `weaponMod1..3`, `helmMod1..3`, `shieldMod1..3` (each with Code, Param, Min, Max).
 * 2. Socket modifier dispatch:
 *    - Weapon (`weap`, `mele`, `bow`, etc.) -> `weaponMod1..3`
 *    - Helm OR Body Armor (`tors`) -> `helmMod1..3`
 *      (CRITICAL: `helm` mods apply to both helmets AND body armor/torso!)
 *    - Shield (`shld`, `shie`, `ashd`, `head`) -> `shieldMod1..3`
 * 3. Socket limit calculation (`ItemTypes.txt`):
 *    - `ilvl 1..24`: `maxSock1`
 *    - `ilvl 25..39`: `maxSock25`
 *    - `ilvl 40+`: `maxSock40`
 *    - Allowed sockets = `Math.min(base.gemsockets, itemType.maxSockN)`.
 */

import type { D2Table } from '../world/acts.ts'
import { cell, parseTable } from '../world/acts.ts'
import type { MountedArchives } from '../mpq/mount.ts'
import type { ItemTypeDefinition } from './item-types.ts'
import { getEmbeddedDropTables } from './embedded-drop-tables.ts'
import {
  isGemCode,
  isRuneCode,
  isJewelCode,
  getSocketableInfo,
  RUNE_INFO,
  type SocketTargetCategory,
} from './gems-data.ts'
import { ItemFlag, ItemQuality, type Item, type RolledItemProp } from './items.ts'
import { checkRunewordMatch, isNormalQuality } from './runeword.ts'
import { translateItemName } from '../i18n/tooltip-i18n.ts'

/** File path of `Gems.txt` inside MPQ archives. */
export const GEMS_TABLE_PATH = 'data\\global\\excel\\Gems.txt'

/**
 * Modifier descriptor for a gem or rune socketed into an item.
 */
export interface GemModifier {
  /** Stat property code (e.g. 'att', 'str', 'ac', 'dmg-fire', 'thorns'). */
  readonly code: string
  /** Optional parameter (e.g. duration in frames like 125 or 75, or 0). */
  readonly param?: number | string | undefined
  /** Alias for param for compatibility with UniqueItemProp / SetBonusProp. */
  readonly par?: number | string | undefined
  /** Minimum roll value. */
  readonly min: number
  /** Maximum roll value. */
  readonly max: number
}

/**
 * Definition of an individual gem or rune entry from `Gems.txt`.
 */
export interface Gem {
  /** Name of the gem or rune (e.g. 'Chipped Amethyst', 'El Rune'). */
  readonly name: string
  /** 3-letter item code (e.g. 'gcv', 'r01'). */
  readonly code: string
  /** Rune display letter (e.g. 'El', 'Eld') if present. */
  readonly letter?: string | undefined
  /** Color transform ID if present. */
  readonly transform?: number | undefined
  /** Number of modifier categories or mods specified in table. */
  readonly nummods: number
  /** Whether this record represents a rune (r01..r33). */
  readonly isRune: boolean
  /** Whether this record represents a gemstone (35 standard gems). */
  readonly isGem: boolean
  /** Modifiers applied when socketed into a weapon. */
  readonly weaponMods: readonly GemModifier[]
  /** Modifiers applied when socketed into a helm or torso (body armor). */
  readonly helmMods: readonly GemModifier[]
  /** Modifiers applied when socketed into a shield. */
  readonly shieldMods: readonly GemModifier[]

  /** Individual modifier accessors */
  readonly weaponMod1?: GemModifier | undefined
  readonly weaponMod2?: GemModifier | undefined
  readonly weaponMod3?: GemModifier | undefined
  readonly helmMod1?: GemModifier | undefined
  readonly helmMod2?: GemModifier | undefined
  readonly helmMod3?: GemModifier | undefined
  readonly shieldMod1?: GemModifier | undefined
  readonly shieldMod2?: GemModifier | undefined
  readonly shieldMod3?: GemModifier | undefined
}

import { CaseInsensitiveMap } from './tables.ts'

/**
 * Parsed Gems.txt table providing collection and lookup access.
 */
export interface GemTable {
  /** All parsed gem and rune records in file order (68 records in vanilla 1.13c). */
  readonly all: readonly Gem[]
  /** Alias for `all`. */
  readonly rows: readonly Gem[]
  /** 35 standard gemstone records. */
  readonly gems: readonly Gem[]
  /** 33 rune records. */
  readonly runes: readonly Gem[]
  /** Map of gems/runes indexed by 3-letter code (case-insensitive). */
  readonly byCode: ReadonlyMap<string, Gem>
  /** Map of gems/runes indexed by name (case-insensitive). */
  readonly byName: ReadonlyMap<string, Gem>
  /** Lookup a gem or rune by code or name (case-insensitive). */
  get(codeOrName: string): Gem | undefined
  /** Total count of records (68 in vanilla 1.13c). */
  readonly length: number
  /** Allows iteration over all gem and rune records. */
  [Symbol.iterator](): IterableIterator<Gem>
  /** Array index access. */
  readonly [index: number]: Gem | undefined
}

/**
 * Parses a parameter cell into number or string or undefined.
 */
export function parseParam(val: string | undefined): number | string | undefined {
  if (val === undefined) return undefined
  const trimmed = val.trim()
  if (trimmed === '') return undefined
  if (/^-?\d+$/.test(trimmed)) {
    const num = Number(trimmed)
    if (Number.isFinite(num)) return num
  }
  return trimmed
}

/**
 * Parses a numeric cell with fallback.
 */
export function parseNumber(val: string | undefined, fallback = 0): number {
  if (val === undefined) return fallback
  const trimmed = val.trim()
  if (trimmed === '') return fallback
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : fallback
}

/**
 * Predicate function to check if `typeCode` descends from `ancestorCode`.
 */
export type IsAPredicate = (typeCode: string, ancestorCode: string) => boolean

/**
 * Parses `Gems.txt` from a raw tab-separated D2Table, Uint8Array, or string.
 *
 * In Diablo II 1.13c:
 * - 69 raw rows minus 1 'Expansion' row = exactly 68 data rows.
 * - 35 gems + 33 runes.
 * - Columns: name, letter, transform, code, nummods, weaponMod1..3, helmMod1..3, shieldMod1..3.
 *
 * @param input - Raw D2Table, Uint8Array, or TSV string.
 * @returns Parsed `GemTable`.
 */
export function parseGemsTable(table: D2Table): GemTable
export function parseGemsTable(bytes: Uint8Array): GemTable
export function parseGemsTable(tsv: string): GemTable
export function parseGemsTable(input: D2Table | Uint8Array | string): GemTable
export function parseGemsTable(input: D2Table | Uint8Array | string): GemTable {
  let table: D2Table
  if (typeof input === 'string') {
    table = parseTable(new TextEncoder().encode(input))
  } else if (input instanceof Uint8Array) {
    table = parseTable(input)
  } else {
    table = input
  }

  const all: Gem[] = []
  const gems: Gem[] = []
  const runes: Gem[] = []
  const byCode = new CaseInsensitiveMap<Gem>()
  const byName = new CaseInsensitiveMap<Gem>()

  for (const row of table.rows) {
    const code = cell(table, row, 'code').trim()
    const name = cell(table, row, 'name').trim()

    // Filter out rows where code is empty, or placeholder / expansion separator rows
    if (!code || name === 'Expansion' || name === 'None') {
      continue
    }

    const parseMod = (prefix: 'weapon' | 'helm' | 'shield', slot: number): GemModifier | undefined => {
      const modCode = cell(table, row, `${prefix}Mod${slot}Code`).trim()
      if (!modCode) return undefined
      const rawParam = cell(table, row, `${prefix}Mod${slot}Param`)
      const param = parseParam(rawParam)
      const min = parseNumber(cell(table, row, `${prefix}Mod${slot}Min`), 0)
      const max = parseNumber(cell(table, row, `${prefix}Mod${slot}Max`), 0)
      return {
        code: modCode,
        ...(param !== undefined ? { param, par: param } : {}),
        min,
        max,
      }
    }

    const weaponMod1 = parseMod('weapon', 1)
    const weaponMod2 = parseMod('weapon', 2)
    const weaponMod3 = parseMod('weapon', 3)
    const helmMod1 = parseMod('helm', 1)
    const helmMod2 = parseMod('helm', 2)
    const helmMod3 = parseMod('helm', 3)
    const shieldMod1 = parseMod('shield', 1)
    const shieldMod2 = parseMod('shield', 2)
    const shieldMod3 = parseMod('shield', 3)

    const weaponMods = [weaponMod1, weaponMod2, weaponMod3].filter((m): m is GemModifier => m !== undefined)
    const helmMods = [helmMod1, helmMod2, helmMod3].filter((m): m is GemModifier => m !== undefined)
    const shieldMods = [shieldMod1, shieldMod2, shieldMod3].filter((m): m is GemModifier => m !== undefined)

    const letterRaw = cell(table, row, 'letter').trim()
    const letter = letterRaw !== '' ? letterRaw : undefined

    const transformRaw = cell(table, row, 'transform').trim()
    const transform = transformRaw !== '' ? parseNumber(transformRaw) : undefined

    const nummods = parseNumber(cell(table, row, 'nummods'), 0)

    const isRune = /^r\d{2}$/i.test(code) || (letter !== undefined && letter !== '')
    const isGem = !isRune

    const gem: Gem = {
      name,
      code,
      letter,
      transform,
      nummods,
      isRune,
      isGem,
      weaponMods,
      helmMods,
      shieldMods,
      ...(weaponMod1 ? { weaponMod1 } : {}),
      ...(weaponMod2 ? { weaponMod2 } : {}),
      ...(weaponMod3 ? { weaponMod3 } : {}),
      ...(helmMod1 ? { helmMod1 } : {}),
      ...(helmMod2 ? { helmMod2 } : {}),
      ...(helmMod3 ? { helmMod3 } : {}),
      ...(shieldMod1 ? { shieldMod1 } : {}),
      ...(shieldMod2 ? { shieldMod2 } : {}),
      ...(shieldMod3 ? { shieldMod3 } : {}),
    }

    all.push(gem)
    if (isRune) {
      runes.push(gem)
    } else {
      gems.push(gem)
    }

    byCode.set(code, gem)
    byName.set(name, gem)
  }

  const tableObj: GemTable = {
    all,
    rows: all,
    gems,
    runes,
    byCode,
    byName,
    get(codeOrName: string): Gem | undefined {
      return byCode.get(codeOrName) ?? byName.get(codeOrName)
    },
    get length(): number {
      return all.length
    },
    [Symbol.iterator](): IterableIterator<Gem> {
      return all[Symbol.iterator]()
    },
  }

  // Support array index access table[0]
  return new Proxy(tableObj, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        return all[Number(prop)]
      }
      return Reflect.get(target, prop, receiver)
    },
  })
}

/**
 * Loads and parses `Gems.txt` from mounted MPQ archives.
 *
 * @param archives - Mounted MPQ archives.
 * @param tablePath - Optional path inside archive (defaults to GEMS_TABLE_PATH).
 * @returns Promise resolving to `GemTable`.
 */
export async function loadGems(
  archives: MountedArchives,
  tablePath = GEMS_TABLE_PATH,
): Promise<GemTable> {
  const bytes = await archives.read(tablePath)
  const d2Table = parseTable(bytes)
  return parseGemsTable(d2Table)
}

/**
 * 1.13c gold standard `Gems.txt` embedded TSV data (68 active gem & rune rows + 1 Expansion separator).
 */
export const CANONICAL_GEMS_TSV = `name\tletter\ttransform\tcode\tnummods\tweaponMod1Code\tweaponMod1Param\tweaponMod1Min\tweaponMod1Max\tweaponMod2Code\tweaponMod2Param\tweaponMod2Min\tweaponMod2Max\tweaponMod3Code\tweaponMod3Param\tweaponMod3Min\tweaponMod3Max\thelmMod1Code\thelmMod1Param\thelmMod1Min\thelmMod1Max\thelmMod2Code\thelmMod2Param\thelmMod2Min\thelmMod2Max\thelmMod3Code\thelmMod3Param\thelmMod3Min\thelmMod3Max\tshieldMod1Code\tshieldMod1Param\tshieldMod1Min\tshieldMod1Max\tshieldMod2Code\tshieldMod2Param\tshieldMod2Min\tshieldMod2Max\tshieldMod3Code\tshieldMod3Param\tshieldMod3Min\tshieldMod3Max
Chipped Amethyst\t\t18\tgcv\t3\tatt\t0\t40\t40\t\t\t\t\t\t0\t0\t0\tstr\t0\t3\t3\t\t0\t0\t0\t\t0\t0\t0\tac\t0\t8\t8\t\t0\t0\t0\t\t0\t0\t0
Flawed Amethyst\t\t18\tgfv\t3\tatt\t0\t60\t60\t\t\t\t\t\t0\t0\t0\tstr\t0\t4\t4\t\t0\t0\t0\t\t0\t0\t0\tac\t0\t12\t12\t\t0\t0\t0\t\t0\t0\t0
Amethyst\t\t18\tgsv\t3\tatt\t0\t80\t80\t\t\t\t\t\t0\t0\t0\tstr\t0\t6\t6\t\t0\t0\t0\t\t0\t0\t0\tac\t0\t18\t18\t\t0\t0\t0\t\t0\t0\t0
Flawless Amethyst\t\t18\tgzv\t3\tatt\t0\t100\t100\t\t\t\t\t\t0\t0\t0\tstr\t0\t8\t8\t\t0\t0\t0\t\t0\t0\t0\tac\t0\t24\t24\t\t0\t0\t0\t\t0\t0\t0
Perfect Amethyst\t\t17\tgpv\t3\tatt\t0\t150\t150\t\t\t\t\t\t0\t0\t0\tstr\t0\t10\t10\t\t0\t0\t0\t\t0\t0\t0\tac\t0\t30\t30\t\t0\t0\t0\t\t0\t0\t0
Chipped Saphire\t\t5\tgcb\t3\tcold-min\t0\t1\t1\tcold-max\t0\t3\t3\tcold-len\t0\t25\t25\tmana\t0\t10\t10\t\t0\t0\t0\t\t0\t0\t0\tres-cold\t0\t12\t12\t\t0\t0\t0\t\t0\t0\t0
Flawed Saphire\t\t5\tgfb\t3\tcold-min\t0\t3\t3\tcold-max\t0\t5\t5\tcold-len\t0\t35\t35\tmana\t0\t17\t17\t\t0\t0\t0\t\t0\t0\t0\tres-cold\t0\t16\t16\t\t0\t0\t0\t\t0\t0\t0
Saphire\t\t5\tgsb\t3\tcold-min\t0\t4\t4\tcold-max\t0\t7\t7\tcold-len\t0\t50\t50\tmana\t0\t24\t24\t\t0\t0\t0\t\t0\t0\t0\tres-cold\t0\t22\t22\t\t0\t0\t0\t\t0\t0\t0
Flwless Saphire\t\t5\tglb\t3\tcold-min\t0\t6\t6\tcold-max\t0\t10\t10\tcold-len\t0\t60\t60\tmana\t0\t31\t31\t\t0\t0\t0\t\t0\t0\t0\tres-cold\t0\t28\t28\t\t0\t0\t0\t\t0\t0\t0
Perfect Saphire\t\t6\tgpb\t3\tcold-min\t0\t10\t10\tcold-max\t0\t14\t14\tcold-len\t0\t75\t75\tmana\t0\t38\t38\t\t0\t0\t0\t\t0\t0\t0\tres-cold\t0\t40\t40\t\t0\t0\t0\t\t0\t0\t0
Chipped Emerald\t\t11\tgcg\t3\tpois-min\t0\t34\t34\tpois-max\t0\t34\t34\tpois-len\t0\t75\t75\tdex\t0\t3\t3\t\t0\t0\t0\t\t0\t0\t0\tres-pois\t0\t12\t12\t\t0\t0\t0\t\t0\t0\t0
Flawed Emerald\t\t11\tgfg\t3\tpois-min\t0\t51\t51\tpois-max\t0\t51\t51\tpois-len\t0\t100\t100\tdex\t0\t4\t4\t\t0\t0\t0\t\t0\t0\t0\tres-pois\t0\t16\t16\t\t0\t0\t0\t\t0\t0\t0
Emerald\t\t11\tgsg\t3\tpois-min\t0\t82\t82\tpois-max\t0\t82\t82\tpois-len\t0\t125\t125\tdex\t0\t6\t6\t\t0\t0\t0\t\t0\t0\t0\tres-pois\t0\t22\t22\t\t0\t0\t0\t\t0\t0\t0
Flawless Emerald\t\t11\tglg\t3\tpois-min\t0\t101\t101\tpois-max\t0\t101\t101\tpois-len\t0\t152\t152\tdex\t0\t8\t8\t\t0\t0\t0\t\t0\t0\t0\tres-pois\t0\t28\t28\t\t0\t0\t0\t\t0\t0\t0
Perfect Emerald\t\t12\tgpg\t3\tpois-min\t0\t143\t143\tpois-max\t0\t143\t143\tpois-len\t0\t179\t179\tdex\t0\t10\t10\t\t0\t0\t0\t\t0\t0\t0\tres-pois\t0\t40\t40\t\t0\t0\t0\t\t0\t0\t0
Chipped Ruby\t\t8\tgcr\t3\tfire-min\t0\t3\t3\tfire-max\t0\t4\t4\t\t0\t0\t0\thp\t0\t10\t10\t\t0\t0\t0\t\t0\t0\t0\tres-fire\t0\t12\t12\t\t0\t0\t0\t\t0\t0\t0
Flawed Ruby\t\t8\tgfr\t3\tfire-min\t0\t5\t5\tfire-max\t0\t8\t8\t\t0\t0\t0\thp\t0\t17\t17\t\t0\t0\t0\t\t0\t0\t0\tres-fire\t0\t16\t16\t\t0\t0\t0\t\t0\t0\t0
Ruby\t\t8\tgsr\t3\tfire-min\t0\t8\t8\tfire-max\t0\t12\t12\t\t0\t0\t0\thp\t0\t24\t24\t\t0\t0\t0\t\t0\t0\t0\tres-fire\t0\t22\t22\t\t0\t0\t0\t\t0\t0\t0
Flawless Ruby\t\t8\tglr\t3\tfire-min\t0\t10\t10\tfire-max\t0\t16\t16\t\t0\t0\t0\thp\t0\t31\t31\t\t0\t0\t0\t\t0\t0\t0\tres-fire\t0\t28\t28\t\t0\t0\t0\t\t0\t0\t0
Perfect Ruby\t\t9\tgpr\t3\tfire-min\t0\t15\t15\tfire-max\t0\t20\t20\t\t0\t0\t0\thp\t0\t38\t38\t\t0\t0\t0\t\t0\t0\t0\tres-fire\t0\t40\t40\t\t0\t0\t0\t\t0\t0\t0
Chipped Diamond\t\t1\tgcw\t3\tdmg-undead\t0\t28\t28\t\t\t\t\t\t0\t0\t0\tatt\t0\t20\t20\t\t0\t0\t0\t\t0\t0\t0\tres-all\t0\t6\t6\t\t0\t0\t0\t\t0\t0\t0
Flawed Diamond\t\t1\tgfw\t3\tdmg-undead\t0\t34\t34\t\t\t\t\t\t0\t0\t0\tatt\t0\t40\t40\t\t0\t0\t0\t\t0\t0\t0\tres-all\t0\t8\t8\t\t0\t0\t0\t\t0\t0\t0
Diamond\t\t1\tgsw\t3\tdmg-undead\t0\t44\t44\t\t\t\t\t\t0\t0\t0\tatt\t0\t60\t60\t\t0\t0\t0\t\t0\t0\t0\tres-all\t0\t11\t11\t\t0\t0\t0\t\t0\t0\t0
Flawless Diamond\t\t1\tglw\t3\tdmg-undead\t0\t54\t54\t\t\t\t\t\t0\t0\t0\tatt\t0\t80\t80\t\t0\t0\t0\t\t0\t0\t0\tres-all\t0\t14\t14\t\t0\t0\t0\t\t0\t0\t0
Perfect Diamond\t\t0\tgpw\t3\tdmg-undead\t0\t68\t68\t\t\t\t\t\t0\t0\t0\tatt\t0\t100\t100\t\t0\t0\t0\t\t0\t0\t0\tres-all\t0\t19\t19\t\t0\t0\t0\t\t0\t0\t0
Chipped Topaz\t\t14\tgcy\t3\tltng-min\t0\t1\t1\tltng-max\t0\t8\t8\t\t0\t0\t0\tmag%\t0\t9\t9\t\t0\t0\t0\t\t0\t0\t0\tres-ltng\t0\t12\t12\t\t0\t0\t0\t\t0\t0\t0
Flawed Topaz\t\t14\tgfy\t3\tltng-min\t0\t1\t1\tltng-max\t0\t14\t14\t\t0\t0\t0\tmag%\t0\t13\t13\t\t0\t0\t0\t\t0\t0\t0\tres-ltng\t0\t16\t16\t\t0\t0\t0\t\t0\t0\t0
Topaz\t\t14\tgsy\t3\tltng-min\t0\t1\t1\tltng-max\t0\t22\t22\t\t0\t0\t0\tmag%\t0\t16\t16\t\t0\t0\t0\t\t0\t0\t0\tres-ltng\t0\t22\t22\t\t0\t0\t0\t\t0\t0\t0
Flawless Topaz\t\t14\tgly\t3\tltng-min\t0\t1\t1\tltng-max\t0\t30\t30\t\t0\t0\t0\tmag%\t0\t20\t20\t\t0\t0\t0\t\t0\t0\t0\tres-ltng\t0\t28\t28\t\t0\t0\t0\t\t0\t0\t0
Perfect Topaz\t\t13\tgpy\t3\tltng-min\t0\t1\t1\tltng-max\t0\t40\t40\t\t0\t0\t0\tmag%\t0\t24\t24\t\t0\t0\t0\t\t0\t0\t0\tres-ltng\t0\t40\t40\t\t0\t0\t0\t\t0\t0\t0
Chipped Skull\t\t2\tskc\t3\tmanasteal\t0\t1\t1\tlifesteal\t0\t2\t2\t\t\t\t\tregen\t0\t2\t2\tregen-mana\t0\t8\t8\t\t0\t0\t0\tthorns\t0\t4\t4\t\t0\t0\t0\t\t0\t0\t0
Flawed Skull\t\t2\tskf\t3\tmanasteal\t0\t2\t2\tlifesteal\t0\t2\t2\t\t\t\t\tregen\t0\t3\t3\tregen-mana\t0\t8\t8\t\t0\t0\t0\tthorns\t0\t8\t8\t\t0\t0\t0\t\t0\t0\t0
Skull\t\t2\tsku\t3\tmanasteal\t0\t2\t2\tlifesteal\t0\t3\t3\t\t\t\t\tregen\t0\t3\t3\tregen-mana\t0\t12\t12\t\t0\t0\t0\tthorns\t0\t12\t12\t\t0\t0\t0\t\t0\t0\t0
Flawless Skull\t\t2\tskl\t3\tmanasteal\t0\t3\t3\tlifesteal\t0\t3\t3\t\t\t\t\tregen\t0\t4\t4\tregen-mana\t0\t12\t12\t\t0\t0\t0\tthorns\t0\t16\t16\t\t0\t0\t0\t\t0\t0\t0
Perfect Skull\t\t3\tskz\t3\tmanasteal\t0\t3\t3\tlifesteal\t0\t4\t4\t\t\t\t\tregen\t0\t5\t5\tregen-mana\t0\t19\t19\t\t0\t0\t0\tthorns\t0\t20\t20\t\t0\t0\t0\t\t0\t0\t0
Expansion\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t
El Rune\tEl\t18\tr01\t1\tlight\t\t1\t1\tatt\t\t50\t50\t\t\t\t\tlight\t\t1\t1\tac\t\t15\t15\t\t\t\t\tlight\t\t1\t1\tac\t\t15\t15\t\t\t\t0
Eld Rune\tEld\t18\tr02\t1\tatt-undead\t\t50\t50\tdmg-undead\t\t75\t75\t\t\t\t\tstamdrain\t\t15\t15\t\t\t\t\t\t\t\t\tblock\t\t7\t7\t\t\t\t\t\t\t\t0
Tir Rune\tTir\t18\tr03\t1\tmana-kill\t\t2\t2\t\t\t\t\t\t\t\t\tmana-kill\t\t2\t2\t\t\t\t\t\t\t\t\tmana-kill\t\t2\t2\t\t\t\t\t\t\t\t0
Nef Rune\tNef\t18\tr04\t1\tknock\t\t1\t1\t\t\t\t\t\t\t\t\tac-miss\t\t30\t30\t\t\t\t\t\t\t\t\tac-miss\t\t30\t30\t\t\t\t\t\t\t\t0
Eth Rune\tEth\t18\tr05\t1\treduce-ac\t\t25\t25\t\t\t\t\t\t\t\t\tregen-mana\t\t15\t15\t\t\t\t\t\t\t\t\tregen-mana\t\t15\t15\t\t\t\t\t\t\t\t0
Ith Rune\tIth\t18\tr06\t1\tdmg-max\t\t9\t9\t\t\t\t\t\t\t\t\tdmg-to-mana\t\t15\t15\t\t\t\t\t\t\t\t\tdmg-to-mana\t\t15\t15\t\t\t\t\t\t\t\t0
Tal Rune\tTal\t18\tr07\t1\tdmg-pois\t125\t154\t154\t\t\t\t\t\t\t\t\tres-pois\t\t30\t30\t\t\t\t\t\t\t\t\tres-pois\t\t35\t35\t\t\t\t\t\t\t\t0
Ral Rune\tRal\t18\tr08\t1\tdmg-fire\t\t5\t30\t\t\t\t\t\t\t\t\tres-fire\t\t30\t30\t\t\t\t\t\t\t\t\tres-fire\t\t35\t35\t\t\t\t\t\t\t\t0
Ort Rune\tOrt\t18\tr09\t1\tdmg-ltng\t\t1\t50\t\t\t\t\t\t\t\t\tres-ltng\t\t30\t30\t\t\t\t\t\t\t\t\tres-ltng\t\t35\t35\t\t\t\t\t\t\t\t0
Thul Rune\tThul\t18\tr10\t1\tdmg-cold\t75\t3\t14\t\t\t\t\t\t\t\t\tres-cold\t\t30\t30\t\t\t\t\t\t\t\t\tres-cold\t\t35\t35\t\t\t\t\t\t\t\t0
Amn Rune\tAmn\t18\tr11\t1\tlifesteal\t\t7\t7\t\t\t\t\t\t\t\t\tthorns\t\t14\t14\t\t\t\t\t\t\t\t\tthorns\t\t14\t14\t\t\t\t\t\t\t\t0
Sol Rune\tSol\t18\tr12\t1\tdmg-min\t\t9\t9\t\t\t\t\t\t\t\t\tred-dmg\t\t7\t7\t\t\t\t\t\t\t\t\tred-dmg\t\t7\t7\t\t\t\t\t\t\t\t0
Shael Rune\tShael\t18\tr13\t1\tswing2\t\t20\t20\t\t\t\t\t\t\t\t\tbalance2\t\t20\t20\t\t\t\t\t\t\t\t\tblock2\t\t20\t20\t\t\t\t\t\t\t\t0
Dol Rune\tDol\t18\tr14\t1\thowl\t\t32\t32\t\t\t\t\t\t\t\t\tregen\t\t7\t7\t\t\t\t\t\t\t\t\tregen\t\t7\t7\t\t\t\t\t\t\t\t0
Hel Rune\tHel\t18\tr15\t1\tease\t\t-20\t-20\t\t\t\t\t\t\t\t\tease\t\t-15\t-15\t\t\t\t\t\t\t\t\tease\t\t-15\t-15\t\t\t\t\t\t\t\t0
Io Rune\tIo\t18\tr16\t1\tvit\t\t10\t10\t\t\t\t\t\t\t\t\tvit\t\t10\t10\t\t\t\t\t\t\t\t\tvit\t\t10\t10\t\t\t\t\t\t\t\t0
Lum Rune\tLum\t18\tr17\t1\tenr\t\t10\t10\t\t\t\t\t\t\t\t\tenr\t\t10\t10\t\t\t\t\t\t\t\t\tenr\t\t10\t10\t\t\t\t\t\t\t\t0
Ko Rune\tKo\t18\tr18\t1\tdex\t\t10\t10\t\t\t\t\t\t\t\t\tdex\t\t10\t10\t\t\t\t\t\t\t\t\tdex\t\t10\t10\t\t\t\t\t\t\t\t0
Fal Rune\tFal\t18\tr19\t1\tstr\t\t10\t10\t\t\t\t\t\t\t\t\tstr\t\t10\t10\t\t\t\t\t\t\t\t\tstr\t\t10\t10\t\t\t\t\t\t\t\t0
Lem Rune\tLem\t18\tr20\t1\tgold%\t\t75\t75\t\t\t\t\t\t\t\t\tgold%\t\t50\t50\t\t\t\t\t\t\t\t\tgold%\t\t50\t50\t\t\t\t\t\t\t\t0
Pul Rune\tPul\t18\tr21\t1\tatt-demon\t\t100\t100\tdmg-demon\t\t75\t75\t\t\t\t\tac%\t\t30\t30\t\t\t\t\t\t\t\t\tac%\t\t30\t30\t\t\t\t\t\t\t\t0
Um Rune\tUm\t18\tr22\t1\topenwounds\t\t25\t25\t\t\t\t\t\t\t\t\tres-all\t\t15\t15\t\t\t\t\t\t\t\t\tres-all\t\t22\t22\t\t\t\t\t\t\t\t0
Mal Rune\tMal\t18\tr23\t1\tnoheal\t\t1\t1\t\t\t\t\t\t\t\t\tred-mag\t\t7\t7\t\t\t\t\t\t\t\t\tred-mag\t\t7\t7\t\t\t\t\t\t\t\t0
Ist Rune\tIst\t18\tr24\t1\tmag%\t\t30\t30\t\t\t\t\t\t\t\t\tmag%\t\t25\t25\t\t\t\t\t\t\t\t\tmag%\t\t25\t25\t\t\t\t\t\t\t\t0
Gul Rune\tGul\t18\tr25\t1\tatt%\t\t20\t20\t\t\t\t\t\t\t\t\tres-pois-max\t\t5\t5\t\t\t\t\t\t\t\t\tres-pois-max\t\t5\t5\t\t\t\t\t\t\t\t0
Vex Rune\tVex\t18\tr26\t1\tmanasteal\t\t7\t7\t\t\t\t\t\t\t\t\tres-fire-max\t\t5\t5\t\t\t\t\t\t\t\t\tres-fire-max\t\t5\t5\t\t\t\t\t\t\t\t0
Ohm Rune\tOhm\t18\tr27\t1\tdmg%\t\t50\t50\t\t\t\t\t\t\t\t\tres-cold-max\t\t5\t5\t\t\t\t\t\t\t\t\tres-cold-max\t\t5\t5\t\t\t\t\t\t\t\t0
Lo Rune\tLo\t18\tr28\t1\tdeadly\t\t20\t20\t\t\t\t\t\t\t\t\tres-ltng-max\t\t5\t5\t\t\t\t\t\t\t\t\tres-ltng-max\t\t5\t5\t\t\t\t\t\t\t\t0
Sur Rune\tSur\t18\tr29\t1\tstupidity\t\t1\t1\t\t\t\t\t\t\t\t\tmana%\t\t5\t5\t\t\t\t\t\t\t\t\tmana\t\t50\t50\t\t\t\t\t\t\t\t0
Ber Rune\tBer\t18\tr30\t1\tcrush\t\t20\t20\t\t\t\t\t\t\t\t\tred-dmg%\t\t8\t8\t\t\t\t\t\t\t\t\tred-dmg%\t\t8\t8\t\t\t\t\t\t\t\t0
Jah Rune\tJah\t18\tr31\t1\tignore-ac\t\t1\t1\t\t\t\t\t\t\t\t\thp%\t\t5\t5\t\t\t\t\t\t\t\t\thp\t\t50\t50\t\t\t\t\t\t\t\t0
Cham Rune\tCham\t18\tr32\t1\tfreeze\t\t3\t3\t\t\t\t\t\t\t\t\tnofreeze\t\t1\t1\t\t\t\t\t\t\t\t\tnofreeze\t\t1\t1\t\t\t\t\t\t\t\t0
Zod Rune\tZod\t18\tr33\t1\tindestruct\t\t1\t1\t\t\t\t\t\t\t\t\tindestruct\t\t1\t1\t\t\t\t\t\t\t\t\tindestruct\t\t1\t1\t\t\t\t\t\t\t\t0`

/** Canonical 1.13c GemTable pre-parsed from `CANONICAL_GEMS_TSV`. */
export const CANONICAL_GEMS_TABLE: GemTable = parseGemsTable(CANONICAL_GEMS_TSV)

/**
 * Dispatches gem modifiers based on target item type.
 *
 * Rules:
 * - Weapon (`weap`, `mele`, `bow`, `swor`, etc.) -> `weaponMod1..3`
 * - Helm OR Body Armor (`tors`) -> `helmMod1..3`
 *   (CRITICAL: In Diablo II, `helm` mods apply to both helmets AND body armor!)
 * - Shield (`shld`, `shie`, `ashd`, `head`) -> `shieldMod1..3`
 * - Other types -> `[]`
 *
 * @param gemCode - Gem or rune 3-letter code (e.g. 'gcv', 'r01').
 * @param itemTypeCode - Item type code of socketed item (e.g. 'swor', 'helm', 'tors', 'shie').
 * @param isA - Hierarchy predicate `(typeCode, ancestorCode) => boolean` or Function.
 * @param gemTable - Parsed gem table (defaults to `CANONICAL_GEMS_TABLE`).
 * @returns Array of modifiers applied to the socketed item.
 */
export function getGemModifiers(
  gemCode: string,
  itemTypeCode: string,
  isA?: IsAPredicate | Function,
  gemTable: GemTable = CANONICAL_GEMS_TABLE,
): GemModifier[] {
  const gem = gemTable.get(gemCode)
  if (!gem) return []

  const code = itemTypeCode.trim().toLowerCase()

  const safeIsA = (child: string, parent: string): boolean => {
    if (typeof isA !== 'function') return false
    try {
      return Boolean(isA(child, parent))
    } catch {
      return false
    }
  }

  // 1. Weapon check
  const isWeapon =
    code === 'weap' ||
    code === 'weapon' ||
    code === 'swor' ||
    code === 'sword' ||
    code === 'axe' ||
    code === 'mace' ||
    code === 'hamm' ||
    code === 'club' ||
    code === 'pole' ||
    code === 'spea' ||
    code === 'staf' ||
    code === 'wand' ||
    code === 'scep' ||
    code === 'bow' ||
    code === 'xbow' ||
    code === 'knif' ||
    code === 'dagg' ||
    code === 'jave' ||
    code === 'h2h' ||
    code === 'h2h2' ||
    code === 'orb' ||
    code === 'abow' ||
    code === 'aspe' ||
    code === 'ajav' ||
    safeIsA(code, 'weap') ||
    safeIsA(code, 'mele') ||
    safeIsA(code, 'bow') ||
    safeIsA(code, 'miss') ||
    safeIsA(code, 'rod')

  if (isWeapon) {
    return [...gem.weaponMods]
  }

  // 2. Helm OR Body Armor (torso) check
  // CRITICAL: Helm mods apply to both helmets AND body armor ('tors')!
  const isHelmOrTorso =
    code === 'helm' ||
    code === 'helmet' ||
    code === 'tors' ||
    code === 'torso' ||
    code === 'body' ||
    code === 'armor' ||
    code === 'phlm' ||
    code === 'pelt' ||
    code === 'circ' ||
    code === 'cloa' ||
    safeIsA(code, 'helm') ||
    safeIsA(code, 'tors') ||
    safeIsA(code, 'torso') ||
    safeIsA(code, 'phlm') ||
    safeIsA(code, 'pelt') ||
    safeIsA(code, 'circ')

  if (isHelmOrTorso) {
    return [...gem.helmMods]
  }

  // 3. Shield check
  const isShield =
    code === 'shld' ||
    code === 'shie' ||
    code === 'shield' ||
    code === 'ashd' ||
    code === 'head' ||
    code === 'pala' ||
    safeIsA(code, 'shld') ||
    safeIsA(code, 'shie') ||
    safeIsA(code, 'shield') ||
    safeIsA(code, 'ashd') ||
    safeIsA(code, 'head')

  if (isShield) {
    return [...gem.shieldMods]
  }

  return []
}

const SHIELD_CODES_AND_TAGS = new Set([
  'shld', 'shie', 'shield', 'ashd', 'head', 'pala',
  'buc', 'sml', 'lrg', 'kit', 'tow', 'gts', 'bsh', 'spk',
  'xuc', 'xml', 'xrg', 'xit', 'xow', 'xts', 'xsh', 'xpk',
  'uuc', 'uml', 'urg', 'uit', 'uow', 'uts', 'ush', 'upk',
  'pa1', 'pa2', 'pa3', 'pa4', 'pa5', 'pa6', 'pa7', 'pa8', 'pa9', 'paa', 'pab', 'pac', 'pad', 'pae', 'paf',
  'ne1', 'ne2', 'ne3', 'ne4', 'ne5', 'ne6', 'ne7', 'ne8', 'ne9', 'nea', 'neb', 'nec', 'ned', 'nee', 'nef',
])

const HELM_CODES_AND_TAGS = new Set([
  'helm', 'helmet', 'circ', 'phlm', 'pelt',
  'cap', 'skp', 'hlm', 'fhl', 'ghm', 'crn', 'msk', 'bhm',
  'xap', 'xkp', 'xlm', 'xhl', 'xhm', 'xrn', 'xsk', 'xh9',
  'uap', 'ukp', 'ulm', 'uhl', 'uhm', 'urn', 'usk', 'uh9',
  'ci0', 'ci1', 'ci2', 'ci3',
  'ba1', 'ba2', 'ba3', 'ba4', 'ba5', 'ba6', 'ba7', 'ba8', 'ba9', 'baa', 'bab', 'bac', 'bad', 'bae', 'baf',
  'dr1', 'dr2', 'dr3', 'dr4', 'dr5', 'dr6', 'dr7', 'dr8', 'dr9', 'dra', 'drb', 'drc', 'drd', 'dre', 'drf',
])

const ARMOR_CODES_AND_TAGS = new Set([
  'tors', 'torso', 'body', 'cloa', 'armo', 'armor',
  'qui', 'lea', 'hla', 'stu', 'rng', 'scl', 'chn', 'brs', 'spl', 'plt', 'fld', 'gth', 'ful', 'aar', 'ltp',
  'xui', 'xea', 'xla', 'xtu', 'xng', 'xcl', 'xhn', 'xrs', 'xpl', 'xlt', 'xld', 'xth', 'xul', 'xar', 'xtp',
  'uui', 'uea', 'ula', 'utu', 'ung', 'ucl', 'uhn', 'urs', 'upl', 'ult', 'uld', 'uth', 'uul', 'uar', 'utp',
])

const WEAPON_CODES_AND_TAGS = new Set([
  'weap', 'weapon', 'mele', 'bow', 'miss', 'rod', 'swor', 'sword',
  'axe', 'mace', 'hamm', 'club', 'pole', 'spea', 'staf', 'wand', 'scep',
  'h2h', 'h2h2', 'orb', 'knif', 'dagg', 'jave', 'tkni', 'taxe', 'tpot',
  'xbow', 'abow', 'aspe', 'ajav', 'blun', 'comb',
])

const NON_SOCKETABLE_EQUIP_SLOTS = new Set([
  'gloves', 'boots', 'belt', 'ring1', 'ring2', 'amulet',
])

/**
 * Resolves the 1.13c socket target category ('weapon' | 'helm' | 'armor' | 'shield')
 * for a domain `Item` or UI `UiInventoryItem`, or returns `null` if the item cannot accept sockets.
 */
export function resolveSocketTargetCategory(item: {
  readonly code?: string | undefined
  readonly type?: string | undefined
  readonly allowedSlots?: readonly string[] | undefined
  readonly damage?: string | number | undefined
  readonly defense?: number | undefined
  readonly base?: {
    readonly id?: string | undefined
    readonly kind?: string | undefined
    readonly tags?: readonly string[] | undefined
  } | undefined
}): SocketTargetCategory | null {
  // 1. Check explicit UI allowedSlots if present
  if (item.allowedSlots && item.allowedSlots.length > 0) {
    const slots = item.allowedSlots
    if (slots.includes('helm')) return 'helm'
    if (slots.includes('armor')) return 'armor'
    if (slots.includes('weapon1')) return 'weapon'
    if (slots.includes('weapon2')) {
      const c = (item.code ?? item.base?.id ?? '').trim().toLowerCase()
      const t = (item.type ?? '').trim().toLowerCase()
      if (SHIELD_CODES_AND_TAGS.has(c) || SHIELD_CODES_AND_TAGS.has(t)) {
        return 'shield'
      }
      if (WEAPON_CODES_AND_TAGS.has(c) || WEAPON_CODES_AND_TAGS.has(t)) {
        return 'weapon'
      }
      // If it has weapon damage string/number and no defense, it is an off-hand weapon; otherwise shield/shrunken head
      if (item.damage !== undefined && item.damage !== 0 && item.damage !== '' && !item.defense) {
        return 'weapon'
      }
      return 'shield'
    }
    if (slots.every((s) => NON_SOCKETABLE_EQUIP_SLOTS.has(s))) {
      return null
    }
  }

  // 2. Check domain Item type / tags / code / base.kind
  const candidates: string[] = []
  if (item.type) candidates.push(item.type.trim().toLowerCase())
  if (item.base?.tags) {
    for (const tag of item.base.tags) {
      candidates.push(tag.trim().toLowerCase())
    }
  }
  const itemCode = (item.code ?? item.base?.id ?? '').trim().toLowerCase()
  if (itemCode) candidates.push(itemCode)

  for (const token of candidates) {
    if (SHIELD_CODES_AND_TAGS.has(token)) return 'shield'
    if (HELM_CODES_AND_TAGS.has(token)) return 'helm'
    if (WEAPON_CODES_AND_TAGS.has(token)) return 'weapon'
  }
  for (const token of candidates) {
    if (ARMOR_CODES_AND_TAGS.has(token)) return 'armor'
  }

  if (item.base?.kind === 'weapon') return 'weapon'
  if (typeof item.damage === 'string' && item.damage.trim().length > 0) return 'weapon'
  if (typeof item.damage === 'number' && item.damage > 0) return 'weapon'
  if (item.base?.kind === 'armor') return 'armor'

  return null
}

/**
 * Checks whether a domain `Item` is a valid socketable filler (Gem, Rune, or Jewel).
 */
export function isSocketableDomainItem(item: Item | undefined | null): boolean {
  if (!item) return false
  const code = (item.code ?? item.base?.id ?? '').trim().toLowerCase()
  const type = ((item as { type?: string }).type ?? (item.base as { type?: string } | undefined)?.type ?? '').trim().toLowerCase()
  if (isGemCode(code) || isRuneCode(code) || isJewelCode(code) || isJewelCode(type)) {
    return true
  }
  if (item.rarity === 'rune' || String(item.quality).toLowerCase() === 'rune') {
    return true
  }
  if (item.base?.tags?.some((t) => t.toLowerCase() === 'jewl' || t.toLowerCase() === 'gem')) {
    return true
  }
  return false
}

/**
 * Checks whether `socketable` can be inserted into `host` per Diablo II 1.13c rules:
 * - `socketable` must be a Gem, Rune, or Jewel.
 * - `host` must NOT itself be a socketable filler.
 * - `host` must be identified (`identified !== false`).
 * - `host` must have `totalSockets > 0` and at least 1 open socket.
 * - `host` must belong to a valid socketable equipment category ('weapon' | 'helm' | 'armor' | 'shield').
 */
export function canSocketDomainItem(socketable: Item | undefined | null, host: Item | undefined | null): boolean {
  if (!socketable || !host) return false
  if (!isSocketableDomainItem(socketable)) return false
  if (isSocketableDomainItem(host)) return false
  if (host.identified === false) return false

  const totalSockets = host.totalSockets ?? (host as { sockets?: number }).sockets ?? 0
  if (totalSockets <= 0) return false

  const currentSocketed = host.socketedItems?.length ?? host.socketedCount ?? 0
  if (currentSocketed >= totalSockets) return false

  const category = resolveSocketTargetCategory(host)
  return category !== null
}

/**
 * Resolves the structured `RolledItemProp[]` modifiers contributed by a single socketed item
 * when placed into a host item of `hostCategory`.
 *
 * - **Jewels (`jew` / `jewl`)**: Position-independent! Returns the jewel's own `rolledProps`
 *   (or `stats` converted to `RolledItemProp[]`) identically across all equipment categories.
 * - **Gems & Runes**: Position-dependent! Dispatches `weaponMods` for `'weapon'`,
 *   `helmMods` for `'helm'` and `'armor'`, and `shieldMods` for `'shield'`.
 */
export function getSocketedItemModifiersForHost(
  socketable: Item,
  hostCategory: SocketTargetCategory,
  gemTable: GemTable = CANONICAL_GEMS_TABLE,
): RolledItemProp[] {
  const code = (socketable.code ?? socketable.base?.id ?? '').trim().toLowerCase()
  const type = ((socketable as { type?: string }).type ?? (socketable.base as { type?: string } | undefined)?.type ?? '').trim().toLowerCase()

  // 1. Jewel: slot-independent modifiers
  if (isJewelCode(code) || isJewelCode(type) || socketable.base?.tags?.includes('jewl')) {
    if (socketable.rolledProps && socketable.rolledProps.length > 0) {
      return socketable.rolledProps.map((p) => ({ ...p }))
    }
    const propsFromStats: RolledItemProp[] = []
    for (const [statKey, val] of Object.entries(socketable.stats ?? {})) {
      if (typeof val === 'number' && val !== 0) {
        propsFromStats.push({
          code: statKey,
          value: val,
          min: val,
          max: val,
        })
      }
    }
    return propsFromStats
  }

  // 2. Gem or Rune: slot-dependent modifiers from Gems.txt
  const gem = gemTable.get(code)
  if (!gem) return []

  let mods: readonly GemModifier[]
  switch (hostCategory) {
    case 'weapon':
      mods = gem.weaponMods
      break
    case 'helm':
    case 'armor':
      mods = gem.helmMods
      break
    case 'shield':
      mods = gem.shieldMods
      break
  }

  return mods.map((m) => ({
    code: m.code,
    ...(m.param !== undefined ? { param: m.param } : {}),
    value: m.min,
    min: m.min,
    max: m.max,
  }))
}

function defaultRunewordIsA(child: string, parent: string): boolean {
  const c = child.trim().toLowerCase()
  const p = parent.trim().toLowerCase()
  if (!c || !p) return false
  if (c === p) return true
  if (p === 'pala' && c === 'ashd') return true
  try {
    const tables = getEmbeddedDropTables()
    if (tables.isA(c, p)) return true
    if (p === 'pala' && tables.isA(c, 'ashd')) return true
  } catch {
    // fallback to static sets below
  }
  if (p === 'shld' || p === 'shie') return SHIELD_CODES_AND_TAGS.has(c)
  if (p === 'helm') return HELM_CODES_AND_TAGS.has(c)
  if (p === 'tors' || p === 'armo') return ARMOR_CODES_AND_TAGS.has(c)
  if (p === 'weap') return WEAPON_CODES_AND_TAGS.has(c)
  if (p === 'mele') {
    return WEAPON_CODES_AND_TAGS.has(c) && !['bow', 'xbow', 'abow', 'miss', 'orb', 'tpot'].includes(c)
  }
  if (p === 'miss') {
    return ['bow', 'xbow', 'abow', 'miss'].includes(c)
  }
  return false
}

/**
 * Inserts a socketable `Item` (Gem, Rune, or Jewel) into a socketed `host` `Item`
 * following Diablo II 1.13c rules (`ITEMS_SocketItem`).
 *
 * Throws an error if `canSocketDomainItem(socketable, host)` is false.
 */
export function socketItemIntoHost(
  host: Item,
  socketable: Item,
  gemTable: GemTable = CANONICAL_GEMS_TABLE,
): Item {
  if (
    host &&
    ((host as unknown as { numSockets?: number }).numSockets !== undefined ||
      Array.isArray((host as unknown as { sockets?: unknown[] }).sockets))
  ) {
    const anyHost = host as unknown as { numSockets?: number; sockets?: unknown[] }
    const maxSocks = anyHost.numSockets ?? host.totalSockets ?? 0
    const curSocks = Array.isArray(anyHost.sockets) ? anyHost.sockets : (host.socketedItems ?? [])
    if (
      maxSocks <= 0 ||
      curSocks.length >= maxSocks ||
      (socketable as unknown as { isSocketFiller?: boolean })?.isSocketFiller === false
    ) {
      return null as unknown as Item
    }
    const nextSocks = [...curSocks, socketable]
    return {
      ...host,
      sockets: nextSocks,
      socketedItems: nextSocks as Item[],
      totalSockets: maxSocks,
      socketedCount: nextSocks.length,
    } as unknown as Item
  }

  if (!canSocketDomainItem(socketable, host)) {
    throw new Error(
      `Cannot socket item "${socketable?.name ?? socketable?.code}" into "${host?.name ?? host?.code}"`,
    )
  }

  const category = resolveSocketTargetCategory(host)!
  const totalSockets = host.totalSockets ?? (host as { sockets?: number }).sockets ?? 0
  const insertedCopy: Item = {
    ...socketable,
    stack: 1,
  }
  const newSocketedItems: Item[] = [...(host.socketedItems ?? []), insertedCopy]
  const newSocketedCount = newSocketedItems.length

  // Compute modifiers from the newly socketed item
  const addedProps = getSocketedItemModifiersForHost(insertedCopy, category, gemTable)
  const newRolledProps: RolledItemProp[] = [...(host.rolledProps ?? []), ...addedProps]
  const newStats: Record<string, number> = { ...(host.stats ?? {}) }
  for (const p of addedProps) {
    newStats[p.code] = (newStats[p.code] ?? 0) + p.value
  }

  // Update required level: max(host.reqLevel, socketable.reqLevel)
  const sockCode = (insertedCopy.code ?? insertedCopy.base?.id ?? '').trim().toLowerCase()
  const canonSocketInfo = getSocketableInfo(sockCode)
  const socketReqLevel =
    canonSocketInfo !== undefined
      ? canonSocketInfo.reqLevel
      : ((insertedCopy as { reqLevel?: number }).reqLevel ?? insertedCopy.level ?? 0)
  const hostReqLevel = (host as { reqLevel?: number }).reqLevel ?? 0
  const newReqLevel = Math.max(hostReqLevel, socketReqLevel)

  // Concatenate rune letters if runes are socketed
  const runeLetters: string[] = []
  const allAreRunes = newSocketedItems.every((s) => {
    const c = (s.code ?? s.base?.id ?? '').trim().toLowerCase()
    const rInfo = RUNE_INFO[c]
    if (rInfo) {
      runeLetters.push(rInfo.letter)
      return true
    }
    return false
  })
  const newSocketedRunes =
    runeLetters.length > 0 ? runeLetters.join('') : (host as { runewordRunes?: string }).runewordRunes

  let updatedHost: Item = {
    ...host,
    totalSockets,
    socketedItems: newSocketedItems,
    socketedCount: newSocketedCount,
    rolledProps: newRolledProps,
    stats: newStats,
    _socketPropsMerged: true,
    ...(newReqLevel > 0 ? { reqLevel: newReqLevel } : {}),
    ...(newSocketedRunes ? { runewordRunes: newSocketedRunes } : {}),
  } as Item

  // Check for Runeword activation when all sockets of a normal/superior/low base item are filled with runes
  if (allAreRunes && newSocketedCount === totalSockets && isNormalQuality(host)) {
    const runeCodes = newSocketedItems.map((s) => (s.code ?? s.base?.id ?? '').trim().toLowerCase())
    const rwMatch = checkRunewordMatch(updatedHost, runeCodes, defaultRunewordIsA, undefined, {
      isLadder: true,
    })
    if (rwMatch) {
      const rwProps: RolledItemProp[] = rwMatch.t1Codes.map((m) => ({
        code: m.code,
        ...(m.param !== undefined ? { param: m.param } : {}),
        value: m.min,
        min: m.min,
        max: m.max,
      }))
      const mergedProps = [...newRolledProps, ...rwProps]
      const mergedStats = { ...newStats }
      for (const p of rwProps) {
        mergedStats[p.code] = (mergedStats[p.code] ?? 0) + p.value
      }
      const rwName = rwMatch.runeName || rwMatch.name
      const rwNameZh =
        translateItemName(rwMatch.name) !== rwMatch.name
          ? translateItemName(rwMatch.name)
          : translateItemName(rwName)
      updatedHost = {
        ...updatedHost,
        name: rwName,
        nameZh: rwNameZh,
        rarity: 'runeword',
        runeword: {
          id: rwMatch.runewordId,
          name: rwName,
          key: rwMatch.name,
        },
        flags: {
          ...host.flags,
          identified: true,
          socketed: true,
          runeword: true,
        },
        rawFlags: (((host.rawFlags ?? 0) | ItemFlag.IDENTIFIED | ItemFlag.SOCKETED | ItemFlag.RUNEWORD) >>> 0),
        rolledProps: mergedProps,
        stats: mergedStats,
      } as unknown as Item
    }
  }

  return updatedHost
}

/**
 * Calculates maximum allowed sockets for an item based on base gemsockets,
 * item type socket tier limits, and item level (ilvl).
 *
 * Tier thresholds from `ItemTypes.txt`:
 * - `ilvl 1..24`: `maxSock1`
 * - `ilvl 25..39`: `maxSock25`
 * - `ilvl 40+`: `maxSock40`
 * - Allowed sockets = `Math.min(base.gemsockets, itemType.maxSockN)`.
 *
 * @param baseGemsockets - Max sockets supported by base item definition (`base.gemsockets`).
 * @param itemType - Item type definition containing `maxSock1`, `maxSock25`, `maxSock40`.
 * @param ilvl - Item level (monster level / drop level).
 * @returns Allowed maximum socket count for the given ilvl tier.
 */
export function getMaxSockets(
  baseGemsockets: number,
  itemType: ItemTypeDefinition,
  ilvl: number,
): number {
  if (baseGemsockets <= 0) return 0

  let typeMax: number
  if (ilvl <= 24) {
    typeMax = itemType.maxSock1 ?? 0
  } else if (ilvl <= 39) {
    typeMax = itemType.maxSock25 ?? 0
  } else {
    typeMax = itemType.maxSock40 ?? 0
  }

  return Math.max(0, Math.min(baseGemsockets, typeMax))
}

