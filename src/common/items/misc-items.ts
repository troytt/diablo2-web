/**
 * Diablo II miscellaneous items loader (`Misc.txt`).
 *
 * `Misc.txt` defines all non-weapon, non-armor items: potions, scrolls, runes,
 * charms, gems, jewels, gold, keys, quest items, and books.
 *
 * In vanilla Diablo II 1.13c:
 * - 152 raw rows - 1 'Expansion' separator row = exactly 151 real data rows.
 * - 98 of 151 items are spawnable (`spawnable === true`).
 * - 33 runes `r01`..`r33` with sequential rune numbers 1..33.
 * - `gld` is gold (`isGold === true`, `type === 'gold'`).
 */
import type { D2Table } from '../world/acts.ts'
import { cell, parseTable } from '../world/acts.ts'
import type { ItemBase } from './items.ts'
import type { MountedArchives } from '../mpq/mount.ts'
import { VENDOR_COLUMN_PREFIXES, VENDOR_COUNT, type VendorItemColumns } from '../units/npc-table.ts'

/** File path of `Misc.txt` inside MPQ archives. */
export const MISC_TABLE_PATH = 'data\\global\\excel\\Misc.txt'

/**
 * Definition of a miscellaneous item base from `Misc.txt`, conforming to `ItemBase`.
 */
export interface MiscBase extends ItemBase {
  /** Item code (e.g. 'hp1', 'rin', 'r01'). Same as `id`. */
  readonly id: string
  /** Item code (3-4 characters). */
  readonly code: string
  /** Display name from the `name` column. */
  readonly name: string
  /** String table lookup key from `namestr`. */
  readonly namestr: string
  /** Game version flag (0 = classic, 100 = expansion). */
  readonly version: number
  /** Broad item kind, always 'misc'. */
  readonly kind: 'misc'
  /** Whether the item can drop or spawn randomly (1 or 0 in table). */
  readonly spawnable: boolean
  /** Drop rarity weighting (0..999). */
  readonly rarity: number
  /** Item level (0..90). */
  readonly level: number
  /** Required character level from levelreq column. */
  readonly levelreq?: number | undefined
  /** Primary item type code (e.g. 'hpot', 'ring', 'rune'). */
  readonly type: string
  /** Secondary item type code if defined (e.g. 'gem0'..'gem4'). */
  readonly type2?: string
  /** Base gold purchase cost. */
  readonly cost: number
  /** Cost to purchase in gambling window (0 if not gambleable). */
  readonly gambleCost: number
  /** Inventory grid width in cells. */
  readonly invWidth: number
  /** Inventory grid height in cells. */
  readonly invHeight: number
  /** Whether items of this base can stack in inventory. */
  readonly stackable: boolean
  /** Minimum spawned stack quantity if stackable. */
  readonly minstack?: number
  /** Maximum stack quantity if stackable. */
  readonly maxstack?: number
  /** Default stack quantity when spawned if stackable. */
  readonly spawnstack?: number
  /** Whether the item automatically slots into the potion belt on pickup. */
  readonly autobelt: boolean
  /** Hardcoded spell/effect index parameter if usable. */
  readonly pSpell?: number
  /** Thrown projectile Missiles.txt Id from missiletype column, if > 0. */
  readonly missiletype?: number | undefined
  /** Whether the item can be transmogrified in the Horadric Cube. */
  readonly transmogrify: boolean
  /** Item tags for affix matching ([type, type2]). */
  readonly tags: string[]
  /** Whether this base represents gold (`code === 'gld'`). */
  readonly isGold: boolean
  /** Whether this base is one of the 33 runes (`r01`..`r33`). */
  readonly isRune: boolean
  /** Sequential rune number (1..33) if this base is a rune. */
  readonly runeNumber?: number
  /** Authentic drop SFX sound linker from dropsound column (e.g. 'item_potion', 'item_gold'). */
  readonly dropsound?: string | undefined
  /** Authentic frame at which dropsound triggers (from dropsfxframe column). */
  readonly dropsfxframe?: number | undefined
  /** Authentic use SFX sound linker from usesound column (e.g. 'item_potion_drink', 'item_scroll'). */
  readonly usesound?: string | undefined
  /** Inventory DC6 sprite key from invfile column (e.g. 'invvip', 'invmsf', 'invbox'). */
  readonly invfile?: string | undefined
  /** Dedicated unique inventory DC6 sprite key from uniqueinvfile column (e.g. 'invvip'). */
  readonly uniqueinvfile?: string | undefined

  // ItemBase conformance
  /** How many fit in one cell (from maxstack for stackable items, else 1). */
  readonly maxStack: number
  /** Gold value (from cost). */
  readonly value: number
  /** Weapon damage (0 for misc items). */
  readonly damage: number
  /** Armor rating (0 for misc items). */
  readonly defense: number
  readonly nightmareUpgrade: string
  readonly hellUpgrade: string
  readonly permStoreItem: boolean
  readonly multibuy: boolean
  readonly bitfield1: number
  readonly quest: number
  readonly questDiffCheck: boolean
  readonly vendorColumns: Readonly<Record<number, VendorItemColumns>>
  readonly stat1?: string | undefined
  readonly calc1?: number | undefined
  readonly stat2?: string | undefined
  readonly calc2?: number | undefined
  readonly len?: number | undefined
  readonly state?: string | undefined
}

export interface PotionSpec {
  readonly code: string
  readonly stat1: string
  readonly calc1: number
  readonly stat2?: string | undefined
  readonly calc2?: number | undefined
  readonly len: number
  readonly state?: string | undefined
  readonly isPct?: boolean | undefined
  readonly hpAmount?: number | undefined
  readonly manaAmount?: number | undefined
  readonly staminaRestorePct?: number | undefined
  readonly coldResistBonus?: number | undefined
  readonly poisonResistBonus?: number | undefined
  readonly durationTicks: number
}

/**
 * Canonical Diablo II 1.13c Misc.txt potion effect table (`0x6FC4A6C0`).
 */
export const CANONICAL_POTION_SPECS: Readonly<Record<string, PotionSpec>> = {
  hp1: { code: 'hp1', stat1: 'hitpoints', calc1: 30, len: 150, hpAmount: 30, durationTicks: 150 },
  hp2: { code: 'hp2', stat1: 'hitpoints', calc1: 60, len: 150, hpAmount: 60, durationTicks: 150 },
  hp3: { code: 'hp3', stat1: 'hitpoints', calc1: 100, len: 175, hpAmount: 100, durationTicks: 175 },
  hp4: { code: 'hp4', stat1: 'hitpoints', calc1: 180, len: 175, hpAmount: 180, durationTicks: 175 },
  hp5: { code: 'hp5', stat1: 'hitpoints', calc1: 320, len: 250, hpAmount: 320, durationTicks: 250 },
  mp1: { code: 'mp1', stat1: 'mana', calc1: 20, len: 125, manaAmount: 20, durationTicks: 125 },
  mp2: { code: 'mp2', stat1: 'mana', calc1: 40, len: 125, manaAmount: 40, durationTicks: 125 },
  mp3: { code: 'mp3', stat1: 'mana', calc1: 80, len: 125, manaAmount: 80, durationTicks: 125 },
  mp4: { code: 'mp4', stat1: 'mana', calc1: 150, len: 125, manaAmount: 150, durationTicks: 125 },
  mp5: { code: 'mp5', stat1: 'mana', calc1: 250, len: 125, manaAmount: 250, durationTicks: 125 },
  rvs: { code: 'rvs', stat1: 'hitpoints', calc1: 35, stat2: 'mana', calc2: 35, len: 0, isPct: true, hpAmount: 35, manaAmount: 35, durationTicks: 0 },
  rvl: { code: 'rvl', stat1: 'hitpoints', calc1: 100, stat2: 'mana', calc2: 100, len: 0, isPct: true, hpAmount: 100, manaAmount: 100, durationTicks: 0 },
  vps: { code: 'vps', stat1: 'stamdrain', calc1: 100, len: 750, state: 'staminapot', staminaRestorePct: 100, durationTicks: 750 },
  wms: { code: 'wms', stat1: 'coldresist', calc1: 50, stat2: 'maxcoldresist', calc2: 10, len: 750, state: 'thawing', coldResistBonus: 50, durationTicks: 750 },
  yps: { code: 'yps', stat1: 'poisonresist', calc1: 50, stat2: 'maxpoisonresist', calc2: 10, len: 750, state: 'antidote', poisonResistBonus: 50, durationTicks: 750 },
}

/**
 * Resolve a potion's 1.13c effect parameters from MiscTable (if provided) or CANONICAL_POTION_SPECS.
 */
export function resolvePotionSpec(
  codeOrItem: string | { readonly code?: string; readonly base?: { readonly id?: string } } | null | undefined,
  miscTable?: MiscTable,
): PotionSpec | undefined {
  if (!codeOrItem) return undefined
  const raw = typeof codeOrItem === 'string'
    ? codeOrItem
    : (codeOrItem.code ?? codeOrItem.base?.id ?? '')
  const norm = raw.trim().toLowerCase()
  const canonical = CANONICAL_POTION_SPECS[norm]
  const row = miscTable?.get(norm)
  if (row && row.stat1 && row.calc1 !== undefined) {
    const len = row.len ?? canonical?.len ?? 0
    return {
      ...canonical,
      code: norm,
      stat1: row.stat1,
      calc1: row.calc1,
      ...(row.stat2 ? { stat2: row.stat2 } : {}),
      ...(row.calc2 !== undefined ? { calc2: row.calc2 } : {}),
      len,
      durationTicks: len,
      ...(row.state ? { state: row.state } : {}),
    }
  }
  return canonical
}

import { CaseInsensitiveMap } from './tables.ts'

/**
 * Parsed miscellaneous items table providing collection and indexed lookup access.
 */
export interface MiscTable {
  /** Map of misc item bases keyed by code (case-insensitive and trimmed). */
  readonly byCode: Map<string, MiscBase>
  /** All valid misc item bases in file order (151 items in vanilla 1.13c). */
  readonly all: MiscBase[]
  /** Look up an item base by code. */
  get(code: string): MiscBase | undefined
  /** Look up a rune by its number (1..33 for r01..r33). */
  getRune(num: number): MiscBase | undefined
}

/**
 * Parses `Misc.txt` from a raw tab-separated D2Table (or Uint8Array/string).
 *
 * Filters out:
 * - The `Expansion` separator row
 * - Any rows with empty `code`
 *
 * In vanilla Diablo II 1.13c: 152 raw rows - 1 'Expansion' row = 151 real data rows.
 *
 * @param input - Raw D2Table, Uint8Array bytes, or TSV string.
 * @returns Parsed `MiscTable` with list, code lookup, and rune indexing.
 */
export function parseMiscTable(table: D2Table): MiscTable
export function parseMiscTable(bytes: Uint8Array): MiscTable
export function parseMiscTable(tsv: string): MiscTable
export function parseMiscTable(input: D2Table | Uint8Array | string): MiscTable {
  let table: D2Table
  if (typeof input === 'string') {
    table = parseTable(new TextEncoder().encode(input))
  } else if (input instanceof Uint8Array) {
    table = parseTable(input)
  } else {
    table = input
  }

  const all: MiscBase[] = []
  const byCode = new CaseInsensitiveMap<MiscBase>()
  const runesByNumber = new Map<number, MiscBase>()

  for (const row of table.rows) {
    const code = cell(table, row, 'code').trim()
    const name = cell(table, row, 'name').trim()

    // 152 raw lines - 1 'Expansion' row = 151 real data rows.
    if (!code || name === 'Expansion') {
      continue
    }

    const namestr = cell(table, row, 'namestr').trim()
    const version = Number(cell(table, row, 'version')) || 0
    const spawnable = cell(table, row, 'spawnable').trim() === '1'
    const rarity = Number(cell(table, row, 'rarity')) || 0
    const level = Number(cell(table, row, 'level')) || 0
    const levelreq = Number(cell(table, row, 'levelreq')) || 0
    const type = cell(table, row, 'type').trim()
    const type2Raw = cell(table, row, 'type2').trim()
    const type2 = type2Raw !== '' ? type2Raw : undefined
    const cost = Number(cell(table, row, 'cost')) || 0
    const gambleCost = Number(cell(table, row, 'gamble cost')) || 0
    const invWidth = Number(cell(table, row, 'invwidth')) || 0
    const invHeight = Number(cell(table, row, 'invheight')) || 0
    const stackable = cell(table, row, 'stackable').trim() === '1'

    const minstackRaw = cell(table, row, 'minstack').trim()
    const maxstackRaw = cell(table, row, 'maxstack').trim()
    const spawnstackRaw = cell(table, row, 'spawnstack').trim()

    const minstack = stackable && minstackRaw !== '' ? Number(minstackRaw) : undefined
    const maxstack = stackable && maxstackRaw !== '' ? Number(maxstackRaw) : undefined
    const spawnstack = stackable && spawnstackRaw !== '' ? Number(spawnstackRaw) : undefined

    const autobelt = cell(table, row, 'autobelt').trim() === '1'

    const pSpellRaw = (cell(table, row, 'pSpell') || cell(table, row, 'pspell')).trim()
    const pSpell = pSpellRaw !== '' ? Number(pSpellRaw) : undefined
    const missileTypeRaw = Number(cell(table, row, 'missiletype')) || 0
    const missiletype = missileTypeRaw > 0 ? missileTypeRaw : undefined

    const transmogrify =
      cell(table, row, 'Transmogrify').trim() === '1' ||
      cell(table, row, 'transmogrify').trim() === '1'

    const tags: string[] = type2 !== undefined ? [type, type2] : [type]

    const isGold = code.toLowerCase() === 'gld'

    const runeSuffix = code.slice(1)
    const runeNum = Number(runeSuffix)
    const isRune =
      code.toLowerCase().startsWith('r') &&
      !isNaN(runeNum) &&
      runeNum >= 1 &&
      runeNum <= 33

    const runeNumber = isRune ? runeNum : undefined

    const maxStack = stackable && maxstack !== undefined ? maxstack : 1
    const value = cost
    const damage = 0
    const defense = 0
    const dropsound = (cell(table, row, 'dropsound') || cell(table, row, 'DropSound')).trim() || undefined
    const rawDropFrame = cell(table, row, 'dropsfxframe') || cell(table, row, 'DropSfxFrame')
    const dropsfxframe = rawDropFrame.trim() !== '' ? Number(rawDropFrame) : undefined
    const usesound = (cell(table, row, 'usesound') || cell(table, row, 'UseSound')).trim() || undefined
    const invfile = (cell(table, row, 'invfile') || cell(table, row, 'InvFile')).trim() || undefined
    const uniqueinvfile = (cell(table, row, 'uniqueinvfile') || cell(table, row, 'UniqueInvFile')).trim() || undefined

    const nightmareUpgrade = (cell(table, row, 'NightmareUpgrade') || cell(table, row, 'nightmareupgrade')).trim() || 'xxx'
    const hellUpgrade = (cell(table, row, 'HellUpgrade') || cell(table, row, 'hellupgrade')).trim() || 'xxx'
    const permStoreItem = (cell(table, row, 'PermStoreItem') || cell(table, row, 'permstoreitem')).trim() === '1'
    const multibuy = cell(table, row, 'multibuy').trim() === '1'
    const bitfield1 = Number(cell(table, row, 'bitfield1')) || 0
    const quest = Number(cell(table, row, 'quest')) || 0
    const questDiffCheck = cell(table, row, 'questdiffcheck').trim() === '1'

    const stat1Raw = cell(table, row, 'stat1').trim()
    const calc1Raw = cell(table, row, 'calc1').trim()
    const stat2Raw = cell(table, row, 'stat2').trim()
    const calc2Raw = cell(table, row, 'calc2').trim()
    const lenRaw = cell(table, row, 'len').trim()
    const stateRaw = cell(table, row, 'state').trim()

    const canonicalPotion = CANONICAL_POTION_SPECS[code.toLowerCase()]
    const stat1 = stat1Raw !== '' ? stat1Raw : canonicalPotion?.stat1
    const calc1 = calc1Raw !== '' ? Number(calc1Raw) : canonicalPotion?.calc1
    const stat2 = stat2Raw !== '' ? stat2Raw : canonicalPotion?.stat2
    const calc2 = calc2Raw !== '' ? Number(calc2Raw) : canonicalPotion?.calc2
    const len = lenRaw !== '' ? Number(lenRaw) : canonicalPotion?.len
    const state = stateRaw !== '' ? stateRaw : canonicalPotion?.state

    const vendorColumns: Record<number, VendorItemColumns> = {}
    for (let vId = 0; vId < VENDOR_COUNT; vId++) {
      const prefix = VENDOR_COLUMN_PREFIXES[vId]!
      const min = Number(cell(table, row, `${prefix}Min`) || cell(table, row, `${prefix}min`)) || 0
      const max = Number(cell(table, row, `${prefix}Max`) || cell(table, row, `${prefix}max`)) || 0
      const magicMin = Number(cell(table, row, `${prefix}MagicMin`) || cell(table, row, `${prefix}magicmin`)) || 0
      const magicMax = Number(cell(table, row, `${prefix}MagicMax`) || cell(table, row, `${prefix}magicmax`)) || 0
      const magicLvl = Number(cell(table, row, `${prefix}MagicLvl`) || cell(table, row, `${prefix}magiclvl`)) || 0
      if (min > 0 || max > 0 || magicMin > 0 || magicMax > 0) {
        vendorColumns[vId] = {
          min,
          max,
          magicMin,
          magicMax,
          magicLvl: magicLvl > 0 ? magicLvl : 255,
        }
      }
    }

    const item: MiscBase = {
      id: code,
      code,
      name,
      namestr,
      version,
      kind: 'misc',
      spawnable,
      rarity,
      level,
      levelreq,
      type,
      ...(type2 !== undefined ? { type2 } : {}),
      cost,
      gambleCost,
      invWidth,
      invHeight,
      stackable,
      ...(minstack !== undefined ? { minstack } : {}),
      ...(maxstack !== undefined ? { maxstack } : {}),
      ...(spawnstack !== undefined ? { spawnstack } : {}),
      autobelt,
      ...(pSpell !== undefined ? { pSpell } : {}),
      ...(missiletype !== undefined ? { missiletype } : {}),
      transmogrify,
      tags,
      isGold,
      isRune,
      ...(runeNumber !== undefined ? { runeNumber } : {}),

      maxStack,
      value,
      damage,
      defense,
      ...(dropsound ? { dropsound } : {}),
      ...(dropsfxframe !== undefined && !Number.isNaN(dropsfxframe) ? { dropsfxframe } : {}),
      ...(usesound ? { usesound } : {}),
      ...(invfile ? { invfile } : {}),
      ...(uniqueinvfile ? { uniqueinvfile } : {}),
      nightmareUpgrade,
      hellUpgrade,
      permStoreItem,
      multibuy,
      bitfield1,
      quest,
      questDiffCheck,
      vendorColumns,
      ...(stat1 !== undefined ? { stat1 } : {}),
      ...(calc1 !== undefined && !Number.isNaN(calc1) ? { calc1 } : {}),
      ...(stat2 !== undefined ? { stat2 } : {}),
      ...(calc2 !== undefined && !Number.isNaN(calc2) ? { calc2 } : {}),
      ...(len !== undefined && !Number.isNaN(len) ? { len } : {}),
      ...(state !== undefined ? { state } : {}),
    }

    all.push(item)
    byCode.set(code, item)
    if (isRune && runeNumber !== undefined) {
      runesByNumber.set(runeNumber, item)
    }
  }

  return {
    byCode,
    all,
    get: (c: string) => byCode.get(c),
    getRune: (num: number) => runesByNumber.get(num),
  }
}

/**
 * Loads and parses `Misc.txt` from mounted MPQ archives.
 *
 * @param archives - Mounted MPQ archives.
 * @returns Promise resolving to `MiscTable`.
 */
export async function loadMisc(archives: MountedArchives): Promise<MiscTable> {
  const bytes = await archives.read(MISC_TABLE_PATH)
  const d2Table = parseTable(bytes)
  return parseMiscTable(d2Table)
}
