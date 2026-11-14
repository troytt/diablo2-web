/**
 * Diablo II armor base item loader (`Armor.txt`).
 *
 * Loads all 202 armor bases (helms, body armors, shields, gloves, boots, belts, etc.)
 * from `data/global/excel/Armor.txt` in Diablo II MPQ archives.
 *
 * Each entry conforms to and extends {@link ItemBase}, providing qlvl, defense range (minac/maxac),
 * strength requirements, durability, socket counts, normal/exceptional/elite tier links,
 * and inventory dimensions.
 */
import type { D2Table } from '../world/acts.ts'
import { parseTable } from '../world/acts.ts'
import type { MountedArchives } from '../mpq/mount.ts'
import type { ItemBase } from './items.ts'
import { VENDOR_COLUMN_PREFIXES, VENDOR_COUNT, type VendorItemColumns } from '../units/npc-table.ts'

/** Canonical MPQ path of `Armor.txt`. */
export const ARMOR_TABLE_PATH = 'data\\global\\excel\\Armor.txt'

/**
 * An individual armor base item parsed from `Armor.txt`.
 * Extends {@link ItemBase} to integrate seamlessly with the game item system.
 */
export interface ArmorBase extends ItemBase {
  /** 3-character item code (e.g., 'cap', 'xtp', 'uap'). Matches {@link ItemBase.id}. */
  readonly id: string
  /** 3-character item code. */
  readonly code: string
  /** Internal development note / name from `name` column (e.g. 'Cap/hat'). */
  readonly name: string
  /** Display name string key from `namestr` column (202/202 valid in string.tbl). */
  readonly namestr: string
  /** 0 for classic items, 100 for expansion items. */
  readonly version: number
  /** Broad kind identifier, always 'armor'. */
  readonly kind: 'armor'
  /** Whether the item can drop or be spawned in normal gameplay (all 202 are true). */
  readonly spawnable: boolean
  /** Auto-TC weight within quality tier bucket (1..4). */
  readonly rarity: number
  /** Base quality level (qlvl, 1..85) used for bucket placement and drop reduction. */
  readonly level: number
  /** Minimum character level required to equip. */
  readonly levelreq: number
  /** Minimum base defense roll. */
  readonly minac: number
  /** Maximum base defense roll. */
  readonly maxac: number
  /** Strength requirement to equip. */
  readonly reqstr: number
  /** Maximum durability (0 for indestructible items). */
  readonly durability: number
  /** Base purchase cost in gold. */
  readonly cost: number
  /** Gambling cost in gold. */
  readonly gambleCost: number
  /** Primary item type code (e.g. 'helm', 'tors', 'shld', 'glov', 'boot', 'belt'). */
  readonly type: string
  /** Optional secondary item type code (if present). */
  readonly type2?: string | undefined
  /** Maximum number of gem/rune sockets. */
  readonly gemsockets: number
  /** Authentic drop SFX sound linker from dropsound column (e.g. 'item_helm', 'item_lightarmor'). */
  readonly dropsound?: string | undefined
  /** Authentic frame at which dropsound triggers (from dropsfxframe column). */
  readonly dropsfxframe?: number | undefined
  /** Authentic use SFX sound linker from usesound column. */
  readonly usesound?: string | undefined
  /** Gem application type modifier index. */
  readonly gemapplytype: number
  /** Code of the normal tier version (e.g., 'cap'). */
  readonly normcode: string
  /** Code of the exceptional tier version (e.g., 'xap'). */
  readonly ubercode: string
  /** Code of the elite tier version (e.g., 'uap'). */
  readonly ultracode: string
  /** Width in inventory grid cells. */
  readonly invWidth: number
  /** Height in inventory grid cells. */
  readonly invHeight: number
  /** Tags matching item types, containing [type] or [type, type2]. */
  readonly tags: string[]
  /** Defense rating, representing maxac. */
  readonly defense: number
  /** Maximum stack count (1 for all armors). */
  readonly maxStack: number
  /** Item gold value, matching base cost. */
  readonly value: number
  /** Inherent weapon attack damage (0 for armors). */
  readonly damage: number
  /** Optional AutoMagic group from 'auto prefix' column (e.g. 304 for Paladin shields, 305 for Shrunken Heads). */
  readonly autoPrefix?: number | undefined
  readonly nightmareUpgrade?: string | undefined
  readonly hellUpgrade?: string | undefined
  readonly permStoreItem?: boolean | undefined
  readonly multibuy?: boolean | undefined
  readonly bitfield1?: number | undefined
  readonly quest?: number | undefined
  readonly questDiffCheck?: boolean | undefined
  readonly vendorColumns?: Readonly<Record<number, VendorItemColumns>> | undefined
  /** 3-letter character paperdoll graphic token from alternategfx column (fallback to code). */
  readonly alternategfx?: string | undefined
  /** Composite layer index from component column (0=hd, 7=sh, 16=body armor/gloves/boots/belt). */
  readonly component?: number | undefined
  /** Armor component weight (0=lit, 1=med, 2=hvy) for Right Arm. */
  readonly rArm?: number | undefined
  /** Armor component weight (0=lit, 1=med, 2=hvy) for Left Arm. */
  readonly lArm?: number | undefined
  /** Armor component weight (0=lit, 1=med, 2=hvy) for Torso. */
  readonly torso?: number | undefined
  /** Armor component weight (0=lit, 1=med, 2=hvy) for Legs. */
  readonly legs?: number | undefined
  /** Armor component weight (0=lit, 1=med, 2=hvy) for Right Shoulder Pad (s1). */
  readonly rSPad?: number | undefined
  /** Armor component weight (0=lit, 1=med, 2=hvy) for Left Shoulder Pad (s2). */
  readonly lSPad?: number | undefined
  /** Character paperdoll palette shift table index (0..8) from Transform column. */
  readonly transform?: number | undefined
  /** Inventory 2D icon palette shift table index (0..8) from InvTrans column. */
  readonly invTrans?: number | undefined
  /** Optional magic level bonus from 'magic lvl' column (e.g. Circlets: 3/8/13/18). */
  readonly magicLvl?: number | undefined
}

import { CaseInsensitiveMap } from './tables.ts'

/**
 * Parsed collection of all armor bases.
 */
export class ArmorTable {
  /** All 202 armor bases in file order. */
  readonly all: ArmorBase[]
  /** Map for looking up armors by 3-letter code (case-insensitive). */
  readonly byCode: Map<string, ArmorBase>

  constructor(all: ArmorBase[], byCode: Map<string, ArmorBase>) {
    this.all = all
    this.byCode = byCode
  }

  /**
   * Retrieves an armor base by its 3-letter code.
   * Case-insensitive and trimmed.
   */
  get(code: string): ArmorBase | undefined {
    return this.byCode.get(code)
  }
}

/**
 * Parses `Armor.txt` from a raw tab-separated {@link D2Table}.
 *
 * Filters out:
 * - The `Expansion` separator row
 * - Any rows with empty `code`
 *
 * In vanilla Diablo II 1.13c: 203 raw lines - 1 'Expansion' row = exactly 202 data rows.
 *
 * @param table - Raw parsed tab-separated table.
 * @returns Parsed {@link ArmorTable}.
 */
export function parseArmorTable(table: D2Table): ArmorTable {
  const colMap = new Map<string, number>()
  const lowerMap = new Map<string, number>()

  table.header.forEach((name, idx) => {
    // Only register the first occurrence of duplicate column names
    // (e.g. mindam/maxdam appear at indices 63/64 and 161/162)
    if (!colMap.has(name)) {
      colMap.set(name, idx)
    }
    const lower = name.toLowerCase()
    if (!lowerMap.has(lower)) {
      lowerMap.set(lower, idx)
    }
  })

  const strAt = (row: readonly string[], colName: string): string => {
    const idx = colMap.get(colName) ?? lowerMap.get(colName.toLowerCase())
    return idx !== undefined ? (row[idx] ?? '').trim() : ''
  }

  const numAt = (row: readonly string[], colName: string, fallback = 0): number => {
    const raw = strAt(row, colName)
    if (!raw) return fallback
    const val = Number(raw)
    return Number.isFinite(val) ? val : fallback
  }

  const all: ArmorBase[] = []
  const byCode = new CaseInsensitiveMap<ArmorBase>()

  for (const row of table.rows) {
    const code = strAt(row, 'code')
    const name = strAt(row, 'name')

    // Filter out the 'Expansion' separator row and any empty code rows
    if (!code || name === 'Expansion' || code === 'Expansion') {
      continue
    }

    const namestr = strAt(row, 'namestr')
    const version = numAt(row, 'version', 0)
    const spawnable = strAt(row, 'spawnable') === '1'
    const rarity = numAt(row, 'rarity', 0)
    const level = numAt(row, 'level', 0)
    const levelreq = numAt(row, 'levelreq', 0)
    const minac = numAt(row, 'minac', 0)
    const maxac = numAt(row, 'maxac', 0)
    const reqstr = numAt(row, 'reqstr', 0)
    const durability = numAt(row, 'durability', 0)
    const cost = numAt(row, 'cost', 0)
    const gambleCost = numAt(row, 'gamble cost', 0)
    const type = strAt(row, 'type')
    const rawType2 = strAt(row, 'type2')
    const type2 = rawType2.length > 0 ? rawType2 : undefined
    const gemsockets = numAt(row, 'gemsockets', 0)
    const gemapplytype = numAt(row, 'gemapplytype', 0)
    const normcode = strAt(row, 'normcode')
    const ubercode = strAt(row, 'ubercode')
    const ultracode = strAt(row, 'ultracode')
    const invWidth = numAt(row, 'invwidth', 0)
    const invHeight = numAt(row, 'invheight', 0)
    const rawAutoPrefix = strAt(row, 'auto prefix')
    const parsedAutoPrefix = rawAutoPrefix ? numAt(row, 'auto prefix', 0) : 0
    const autoPrefix = parsedAutoPrefix > 0 ? parsedAutoPrefix : undefined
    const parsedMagicLvl = numAt(row, 'magic lvl', 0)
    const itemMagicLvl = parsedMagicLvl > 0 ? parsedMagicLvl : undefined

    const tags: string[] = []
    if (type) tags.push(type)
    if (type2) tags.push(type2)

    const defense = maxac
    const dropsound = strAt(row, 'dropsound') || undefined
    const dropsfxframe = numAt(row, 'dropsfxframe', 0) || undefined
    const usesound = strAt(row, 'usesound') || undefined

    const nightmareUpgrade = strAt(row, 'NightmareUpgrade') || 'xxx'
    const hellUpgrade = strAt(row, 'HellUpgrade') || 'xxx'
    const permStoreItem = strAt(row, 'PermStoreItem') === '1'
    const multibuy = strAt(row, 'multibuy') === '1'
    const bitfield1 = numAt(row, 'bitfield1', 0)
    const quest = numAt(row, 'quest', 0)
    const questDiffCheck = strAt(row, 'questdiffcheck') === '1'

    const alternategfx = (strAt(row, 'alternategfx') || code).toLowerCase()
    const component = numAt(row, 'component', 16)
    const rArm = numAt(row, 'rArm', 0)
    const lArm = numAt(row, 'lArm', 0)
    const torso = numAt(row, 'Torso', 0)
    const legs = numAt(row, 'Legs', 0)
    const rSPad = numAt(row, 'rSPad', 0)
    const lSPad = numAt(row, 'lSPad', 0)
    // D2Common.dll DATATBLS_LoadItemsTxt (0x6fdca75d..0x6fdca7a8) & ITEMS_GetColor (0x6fd755a6..0x6fd755df):
    // - 'Transform' (+0x141, Armor.txt @156): 3D character paperdoll palette shift table (0..8, e.g. xsk=1 grey.dat, uth=8 invgreybrown.dat, zmb=0).
    // - 'InvTrans' (+0x142, Armor.txt @157): 2D inventory/flippy icon palette shift table (0..8, e.g. xsk=2 grey2.dat, uth=8 invgreybrown.dat, zmb=8).
    // Note: 'transtbl' (+0x12d, Armor.txt @55) is the alpha blending mode paired with 'transparent' (+0x12c, D2Client.dll 0x6fb1e084), NOT a dye table.
    const transform = numAt(row, 'Transform', 0)
    const invTrans = numAt(row, 'InvTrans', 0)

    const vendorColumns: Record<number, VendorItemColumns> = {}
    for (let vId = 0; vId < VENDOR_COUNT; vId++) {
      const prefix = VENDOR_COLUMN_PREFIXES[vId]!
      const min = numAt(row, `${prefix}Min`, 0)
      const max = numAt(row, `${prefix}Max`, 0)
      const magicMin = numAt(row, `${prefix}MagicMin`, 0)
      const magicMax = numAt(row, `${prefix}MagicMax`, 0)
      const magicLvl = numAt(row, `${prefix}MagicLvl`, 0)
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

    const armor: ArmorBase = {
      id: code,
      code,
      name,
      namestr,
      version,
      kind: 'armor',
      spawnable,
      rarity,
      level,
      levelreq,
      minac,
      maxac,
      reqstr,
      durability,
      cost,
      gambleCost,
      type,
      ...(type2 !== undefined ? { type2 } : {}),
      gemsockets,
      gemapplytype,
      normcode,
      ubercode,
      ultracode,
      invWidth,
      invHeight,
      tags,
      defense,
      maxStack: 1,
      value: cost,
      damage: 0,
      ...(autoPrefix !== undefined ? { autoPrefix } : {}),
      ...(itemMagicLvl !== undefined ? { magicLvl: itemMagicLvl } : {}),
      ...(dropsound ? { dropsound } : {}),
      ...(dropsfxframe !== undefined ? { dropsfxframe } : {}),
      ...(usesound ? { usesound } : {}),
      nightmareUpgrade,
      hellUpgrade,
      permStoreItem,
      multibuy,
      bitfield1,
      quest,
      questDiffCheck,
      vendorColumns,
      alternategfx,
      component,
      rArm,
      lArm,
      torso,
      legs,
      rSPad,
      lSPad,
      transform,
      invTrans,
    }

    all.push(armor)
    byCode.set(code, armor)
  }

  return new ArmorTable(all, byCode)
}

/**
 * Loads and parses `Armor.txt` from mounted MPQ archives.
 *
 * @param archives - Mounted MPQ archives.
 * @returns Promise resolving to {@link ArmorTable}.
 */
export async function loadArmor(archives: MountedArchives): Promise<ArmorTable> {
  const bytes = await archives.read(ARMOR_TABLE_PATH)
  const d2Table = parseTable(bytes)
  return parseArmorTable(d2Table)
}
