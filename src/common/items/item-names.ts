/**
 * Item name localization and translation resolver.
 *
 * Implements a three-tier string table lookup chain (patch -> expansion -> base)
 * with language fallback order: CHI -> ENG -> code/key fallback.
 *
 * Ground Truth (D2MOO `source/D2Common/src/DataTbls/ItemsTbls.cpp`):
 * - Armor.txt / Weapons.txt / Misc.txt: `namestr` column (`0x6FD55280`)
 * - UniqueItems.txt: `index` column (`0x6FD584E0`)
 * - SetItems.txt: `index` column (`0x6FD59140`)
 * - Sets.txt: `name` column (`0x6FD59140`)
 * - Runes.txt: `Name` column (`0x6FD5E020`)
 * - Gems.txt: `name` / `code` column (`0x6FD5B2F0`)
 * - LowQualityItems.txt: `Name` column (`0x6FD5BDA0`)
 * - MagicPrefix / MagicSuffix / AutoMagic: `Name` column via `D2LANG_GetTblIndex` (`0x6FD57C20`)
 * - RarePrefix / RareSuffix: `name` column via `D2LANG_GetTblIndex` (`0x6FD58110`)
 */

import { decodeTbl } from '../formats/tbl.ts'
import type { DecodedTbl } from '../formats/tbl.ts'
import type { MountedArchives } from '../mpq/mount.ts'
import { CANONICAL_CHI_TBL_DICT, CANONICAL_ENG_TBL_DICT } from '../data/canonical-tbl-strings.ts'
import type { ArmorBase } from './armor.ts'
import type { WeaponBase } from './weapons.ts'
import type { MiscBase } from './misc-items.ts'
import type { UniqueItem } from './unique-items.ts'
import type { SetItem, SetDefinition } from './set-items.ts'

export type ItemLanguage = 'ENG' | 'CHI'

/** ENG string table paths in search order (patch -> expansion -> base). */
export const ENG_STRING_TABLE_PATHS: readonly string[] = [
  'data\\local\\LNG\\ENG\\patchstring.tbl',
  'data\\local\\LNG\\ENG\\expansionstring.tbl',
  'data\\local\\lng\\eng\\string.tbl',
]

/**
 * CHI string table paths in search order (patch -> base).
 * Note: `expansionstring.tbl` is absent in official 1.13c CHI MPQ;
 * keys missing in CHI must fallback to the ENG chain.
 */
export const CHI_STRING_TABLE_PATHS: readonly string[] = [
  'data\\local\\LNG\\CHI\\patchstring.tbl',
  'data\\local\\LNG\\CHI\\string.tbl',
]

/**
 * Represents an ordered chain of `.tbl` string tables for a language.
 * Searches from first table (highest priority, e.g. patch) to last (base).
 */
export class StringTableChain {
  readonly lang: ItemLanguage
  readonly tables: readonly DecodedTbl[]
  private _dict?: Map<string, string>

  constructor(lang: ItemLanguage, tables: readonly DecodedTbl[]) {
    this.lang = lang
    this.tables = tables
  }

  /**
   * Look up a key in the string table chain.
   * Returns the first non-undefined matching value, or undefined if not found.
   */
  get(key: string): string | undefined {
    for (const table of this.tables) {
      const val = table.dict.get(key)
      if (val !== undefined) return val
    }
    return undefined
  }

  /** Check if a key exists in any table in the chain. */
  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  /**
   * Flattened dictionary view of the chain with earlier tables taking precedence.
   */
  get dict(): ReadonlyMap<string, string> {
    if (!this._dict) {
      const merged = new Map<string, string>()
      // Reverse iteration so earlier tables overwrite later tables
      for (let i = this.tables.length - 1; i >= 0; i--) {
        for (const [k, v] of this.tables[i]!.dict.entries()) {
          merged.set(k, v)
        }
      }
      this._dict = merged
    }
    return this._dict
  }

  [Symbol.iterator](): Iterator<DecodedTbl> {
    return this.tables[Symbol.iterator]()
  }
}

/** Combined chains for both CHI and ENG. */
export interface ItemNameChains {
  readonly chi?: StringTableChain | undefined
  readonly eng?: StringTableChain | undefined
}

/**
 * Loads the string table chain for the specified language from mounted MPQ archives.
 *
 * - ENG: windows-1252 encoding across patchstring -> expansionstring -> string.tbl
 * - CHI: utf-8 encoding across patchstring -> string.tbl
 */
export async function loadStringTableChain(
  archives: MountedArchives,
  lang: ItemLanguage,
): Promise<StringTableChain> {
  const encoding = lang === 'ENG' ? 'windows-1252' : 'utf-8'
  const paths = lang === 'ENG' ? ENG_STRING_TABLE_PATHS : CHI_STRING_TABLE_PATHS
  const tables: DecodedTbl[] = []

  for (const path of paths) {
    if (typeof archives.has === 'function' && !archives.has(path)) {
      continue
    }
    try {
      const bytes = await archives.read(path)
      tables.push(decodeTbl(bytes, encoding))
    } catch {
      // Continue if archive member is missing
    }
  }

  return new StringTableChain(lang, tables)
}

/** Helper to load both CHI and ENG string table chains in parallel. */
export async function loadItemNameChains(
  archives: MountedArchives,
): Promise<{ chi: StringTableChain; eng: StringTableChain }> {
  const [chi, eng] = await Promise.all([
    loadStringTableChain(archives, 'CHI'),
    loadStringTableChain(archives, 'ENG'),
  ])
  return { chi, eng }
}

function extractChainLookup(
  chain: StringTableChain | Map<string, string> | { get(k: string): string | undefined } | null | undefined,
  key: string,
): string | undefined {
  if (!chain || !key) return undefined
  if (typeof chain.get === 'function') {
    return chain.get(key)
  }
  return undefined
}

/**
 * Resolves an item translation key with fallback:
 * 1. CHI chain (if available and found)
 * 2. ENG chain (if available and found)
 * 3. Raw key fallback
 */
export function resolveItemName(
  key: string,
  chiChain?: StringTableChain | ItemNameChains | null,
  engChain?: StringTableChain | null,
): string {
  if (!key) return ''
  let chi: StringTableChain | undefined
  let eng: StringTableChain | undefined

  if (chiChain && ('chi' in chiChain || 'eng' in chiChain)) {
    chi = (chiChain as ItemNameChains).chi
    eng = (chiChain as ItemNameChains).eng
  } else {
    chi = chiChain as StringTableChain | undefined
    eng = engChain ?? undefined
  }

  const chiVal = extractChainLookup(chi, key)
  if (chiVal !== undefined && (key === 'space' || chiVal.trim().length > 0)) return chiVal

  const engVal = extractChainLookup(eng, key)
  if (engVal !== undefined) return engVal

  return key
}

/**
 * Resolves display name for Armor bases (`Armor.txt` `namestr` column).
 */
export function resolveArmorName(
  item: string | ArmorBase | { namestr: string },
  chiChain?: StringTableChain | ItemNameChains | null,
  engChain?: StringTableChain | null,
): string {
  const key = typeof item === 'string' ? item : item.namestr
  return resolveItemName(key, chiChain, engChain)
}

/**
 * Resolves display name for Weapon bases (`Weapons.txt` `namestr` column).
 */
export function resolveWeaponName(
  item: string | WeaponBase | { namestr: string },
  chiChain?: StringTableChain | ItemNameChains | null,
  engChain?: StringTableChain | null,
): string {
  const key = typeof item === 'string' ? item : item.namestr
  return resolveItemName(key, chiChain, engChain)
}

/**
 * Resolves display name for Misc bases (`Misc.txt` `namestr` column).
 */
export function resolveMiscName(
  item: string | MiscBase | { namestr: string },
  chiChain?: StringTableChain | ItemNameChains | null,
  engChain?: StringTableChain | null,
): string {
  const key = typeof item === 'string' ? item : item.namestr
  return resolveItemName(key, chiChain, engChain)
}

/**
 * Resolves display name for Unique items (`UniqueItems.txt` `index` column).
 */
export function resolveUniqueName(
  item: string | UniqueItem | { index: string },
  chiChain?: StringTableChain | ItemNameChains | null,
  engChain?: StringTableChain | null,
): string {
  const key = typeof item === 'string' ? item : item.index
  return resolveItemName(key, chiChain, engChain)
}

/** Alias for `resolveUniqueName`. */
export const resolveUniqueItemName = resolveUniqueName

/**
 * Resolves display name for Set items (`SetItems.txt` `index` column).
 */
export function resolveSetItemName(
  item: string | SetItem | { index: string },
  chiChain?: StringTableChain | ItemNameChains | null,
  engChain?: StringTableChain | null,
): string {
  const key = typeof item === 'string' ? item : item.index
  return resolveItemName(key, chiChain, engChain)
}

/**
 * Resolves display name for Sets (`Sets.txt` `name` column).
 */
export function resolveSetName(
  set: string | SetDefinition | { name?: string; index?: string },
  chiChain?: StringTableChain | ItemNameChains | null,
  engChain?: StringTableChain | null,
): string {
  const key = typeof set === 'string' ? set : (set.name ?? set.index ?? '')
  return resolveItemName(key, chiChain, engChain)
}

/**
 * Resolves display name for Runewords (`Runes.txt` `Name` column, e.g. 'Runeword26' -> 'Doom').
 */
export function resolveRunewordName(
  runeword: string | { Name?: string; name?: string },
  chiChain?: StringTableChain | ItemNameChains | null,
  engChain?: StringTableChain | null,
): string {
  const key = typeof runeword === 'string' ? runeword : (runeword.Name ?? runeword.name ?? '')
  return resolveItemName(key, chiChain, engChain)
}

/**
 * Resolves display name for Runes (`Misc.txt` `namestr` or `code`, e.g. 'r01'..'r33').
 */
export function resolveRuneName(
  rune: string | { namestr?: string; code?: string },
  chiChain?: StringTableChain | ItemNameChains | null,
  engChain?: StringTableChain | null,
): string {
  const key = typeof rune === 'string' ? rune : (rune.namestr ?? rune.code ?? '')
  return resolveItemName(key, chiChain, engChain)
}

/**
 * Resolves display name for Magic/Rare/AutoMagic prefixes and suffixes via `.tbl`
 * (`DATATBLS_LoadMagicSuffix_Prefix_AutomagicTxt` `0x6FD57C20` and
 * `DATATBLS_LoadRareSuffix_PrefixTxt` `0x6FD58110`).
 */
export function resolveAffixName(
  affix: string | { name?: string; Name?: string },
  chiChain?: StringTableChain | ItemNameChains | null,
  engChain?: StringTableChain | null,
): string {
  const key = typeof affix === 'string' ? affix : (affix.name ?? affix.Name ?? '')
  return resolveItemName(key, chiChain, engChain)
}

/** Alias for `resolveAffixName` used for `RarePrefix.txt` / `RareSuffix.txt`. */
export const resolveRareName = resolveAffixName

/**
 * Resolves display name for Gems (`Gems.txt` `code` or `name` column, `0x6FD5B2F0`).
 */
export function resolveGemName(
  gem: string | { code?: string; name?: string },
  chiChain?: StringTableChain | ItemNameChains | null,
  engChain?: StringTableChain | null,
): string {
  const key = typeof gem === 'string' ? gem : (gem.code ?? gem.name ?? '')
  return resolveItemName(key, chiChain, engChain)
}

/**
 * Resolves display name for Low Quality prefixes (`LowQualityItems.txt` `Name` column, `0x6FD5BDA0`).
 */
export function resolveLowQualityName(
  entry: string | { Name?: string; name?: string },
  chiChain?: StringTableChain | ItemNameChains | null,
  engChain?: StringTableChain | null,
): string {
  const key = typeof entry === 'string' ? entry : (entry.Name ?? entry.name ?? '')
  return resolveItemName(key, chiChain, engChain)
}

let cachedEmbeddedChains: { chi: StringTableChain; eng: StringTableChain } | undefined

function createDecodedTblFromRecord(record: Readonly<Record<string, string>>): DecodedTbl {
  const tbl = [] as unknown as DecodedTbl
  tbl.dict = new Map<string, string>(Object.entries(record))
  return tbl
}

/**
 * Returns singleton `StringTableChain` instances backed by the pre-packed 1.13c
 * `.tbl` dictionaries (`CANONICAL_CHI_TBL_DICT` and `CANONICAL_ENG_TBL_DICT`),
 * suitable for zero-MPQ browser runtime resolution.
 */
export function getEmbeddedItemNameChains(): { chi: StringTableChain; eng: StringTableChain } {
  if (!cachedEmbeddedChains) {
    cachedEmbeddedChains = {
      chi: new StringTableChain('CHI', [createDecodedTblFromRecord(CANONICAL_CHI_TBL_DICT)]),
      eng: new StringTableChain('ENG', [createDecodedTblFromRecord(CANONICAL_ENG_TBL_DICT)]),
    }
  }
  return cachedEmbeddedChains
}

/**
 * Looks up a string key directly in the pre-packed 1.13c `.tbl` dictionary.
 */
export function lookupCanonicalTbl(
  key: string,
  lang: ItemLanguage | 'en' | 'zh' = 'ENG',
): string | undefined {
  if (!key) return undefined
  if (lang === 'CHI' || lang === 'zh') {
    return CANONICAL_CHI_TBL_DICT[key] ?? CANONICAL_ENG_TBL_DICT[key]
  }
  return CANONICAL_ENG_TBL_DICT[key]
}

