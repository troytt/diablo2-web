/**
 * Weapons loader and parser (`data/global/excel/Weapons.txt`).
 *
 * Parses Diablo II 1.13c weapons into typed `WeaponBase` records conforming to
 * `ItemBase` in `src/game/items.ts`.
 *
 * In vanilla 1.13c, Weapons.txt contains 307 raw lines:
 * - 1 'Expansion' section separator row (row index 133, name = 'Expansion')
 * - 306 valid weapon data rows across normal, exceptional, elite, and quest/class items.
 *
 * Special parsing considerations:
 * - Column index 18 has an empty string header `""` (between `maxmisdam` and `rangeadder`).
 *   The parser ignores empty header keys to prevent collision with `cell(table, row, '')`.
 * - 15 items (quest items like Wirt's Leg, Horadric Staff, throwing potions) have empty rarity,
 *   which parses to `rarity: 0` (indicating exclusion from auto-generated TreasureClasses).
 */
import type { ItemBase } from './items.ts'
import type { D2Table } from '../world/acts.ts'
import { parseTable } from '../world/acts.ts'
import type { MountedArchives } from '../mpq/mount.ts'
import { VENDOR_COLUMN_PREFIXES, VENDOR_COUNT, type VendorItemColumns } from '../units/npc-table.ts'

/** File path of Weapons.txt inside MPQ archives. */
export const WEAPONS_TABLE_PATH = 'data\\global\\excel\\Weapons.txt'

/**
 * Parsed weapon base definition from `Weapons.txt`, conforming to `ItemBase`.
 */
export interface WeaponBase extends ItemBase {
  /** Table id / item code (e.g. 'hax', 'crs'). */
  readonly id: string
  /** 3-4 letter item code (e.g. 'hax', 'crs'). */
  readonly code: string
  /** Display name from the table (e.g. 'Hand Axe', 'Crystal Sword'). */
  readonly name: string
  /** String lookup key from namestr column. */
  readonly namestr: string
  /** Version number (0 for classic, 100 for expansion). */
  readonly version: number
  /** Kind discriminator, always 'weapon'. */
  readonly kind: 'weapon'
  /** Whether the weapon can spawn as random loot or at vendors. */
  readonly spawnable: boolean
  /** Rarity weight (0..5; 15 quest/special items have rarity=0, excluded from auto-TC). */
  readonly rarity: number
  /** Item level (0..86). */
  readonly level: number
  /** Character level requirement to equip. */
  readonly levelreq: number
  /** One-handed minimum physical damage. */
  readonly mindam: number
  /** One-handed maximum physical damage. */
  readonly maxdam: number
  /** Two-handed minimum physical damage (if two-handed). */
  readonly twoHandedMindam?: number
  /** Two-handed maximum physical damage (if two-handed). */
  readonly twoHandedMaxdam?: number
  /** Whether this weapon is a two-handed weapon. */
  readonly twoHanded: boolean
  /** Whether a Barbarian can wield this two-handed weapon in one hand (from 1or2handed column). */
  readonly oneOrTwoHanded?: boolean | undefined
  /** `StrBonus`: % physical damage per 100 Strength (`floor(str * StrBonus / 100)` %). */
  readonly strBonus: number
  /** `DexBonus`: % physical damage per 100 Dexterity (`floor(dex * DexBonus / 100)` %). */
  readonly dexBonus: number
  /** Minimum thrown / missile physical damage. */
  readonly minMisDam?: number
  /** Maximum thrown / missile physical damage. */
  readonly maxMisDam?: number
  /** Thrown projectile Missiles.txt Id from missiletype column (e.g. 1=javelin, 35=throwaxe, 36=throwknife, 37=glaive, 44..49=potions, 371=pilum). */
  readonly missiletype?: number | undefined
  /** Base weapon attack speed modifier (lower/negative is faster). */
  readonly speed: number
  /** Strength required to equip. */
  readonly reqstr: number
  /** Dexterity required to equip. */
  readonly reqdex: number
  /** Base durability. */
  readonly durability: number
  /** Base gold purchase / sell cost. */
  readonly cost: number
  /** Gold gambling cost. */
  readonly gambleCost: number
  /** Primary item type code (e.g. 'axe', 'swor', 'bow'). */
  readonly type: string
  /** Secondary item type code, if any. */
  readonly type2?: string
  /** Weapon animation class for one-handed wielding (e.g. '1hs', '1ht'). */
  readonly wclass: string
  /** Weapon animation class for two-handed wielding (e.g. '2hs', '2ht', 'bow'). */
  readonly twoHandedWClass?: string
  /** Whether items of this base are stackable (e.g. throwing weapons). */
  readonly stackable: boolean
  /** Minimum stack quantity when spawned. */
  readonly minstack?: number
  /** Maximum stack capacity. */
  readonly maxstack?: number
  /** Weapon melee attack range modifier (hit reach = 1 + rangeadder). */
  readonly rangeadder: number
  /** Code of the normal tier version. */
  readonly normcode: string
  /** Code of the exceptional (uber) tier version. */
  readonly ubercode: string
  /** Code of the elite (ultra) tier version. */
  readonly ultracode: string
  /** Maximum number of sockets this base can spawn with. */
  readonly gemsockets: number
  /** Inventory width in cells (1 or 2). */
  readonly invWidth: number
  /** Inventory height in cells (1 to 4). */
  readonly invHeight: number
  /** Item tags affixes match against: [type, type2] if type2 exists, else [type]. */
  readonly tags: string[]
  /** Peak damage value for ItemBase compliance (equals maxdam). */
  readonly damage: number
  /** Base gold value for ItemBase compliance (equals cost). */
  readonly value: number
  /** Defense rating for ItemBase compliance (always 0 for weapons). */
  readonly defense: number
  /** Maximum stack capacity for ItemBase compliance (maxstack ?? 1). */
  readonly maxStack: number
  /** Optional AutoMagic group from 'auto prefix' column (e.g. 300, 302, 303). */
  readonly autoPrefix?: number
  /** Optional magic level bonus from 'magic lvl' column (e.g. Staves/Wands/Orbs: 1). */
  readonly magicLvl?: number | undefined
  /** Authentic drop SFX sound linker from dropsound column (e.g. 'item_sword', 'item_bow'). */
  readonly dropsound?: string | undefined
  /** Authentic frame at which dropsound triggers (from dropsfxframe column). */
  readonly dropsfxframe?: number | undefined
  /** Authentic use SFX sound linker from usesound column. */
  readonly usesound?: string | undefined
  readonly nightmareUpgrade?: string | undefined
  readonly hellUpgrade?: string | undefined
  readonly permStoreItem?: boolean | undefined
  readonly multibuy?: boolean | undefined
  readonly bitfield1?: number | undefined
  readonly quest?: number | undefined
  readonly questDiffCheck?: boolean | undefined
  readonly vendorColumns?: Readonly<Record<number, VendorItemColumns>> | undefined
  /** 3-letter character paperdoll graphic token from alternateGfx column (fallback to code). */
  readonly alternateGfx?: string | undefined
  /** Lowercase alias matching ArmorBase.alternategfx. */
  readonly alternategfx?: string | undefined
  /** Composite layer index from component column (5=rh, 6=lh, 16=none). */
  readonly component?: number | undefined
  /** Character paperdoll palette shift table index (0..8) from Transform column. */
  readonly transform?: number | undefined
  /** Inventory 2D icon palette shift table index (0..8) from InvTrans column. */
  readonly invTrans?: number | undefined
}

import { CaseInsensitiveMap } from './tables.ts'

/**
 * Parsed weapons table providing array and indexed lookup access.
 */
export interface WeaponTable {
  /** Map of weapons indexed by 3-4 letter code (case-insensitive). */
  readonly byCode: Map<string, WeaponBase>
  /** All parsed weapon bases in table order (306 items in vanilla 1.13c). */
  readonly all: WeaponBase[]
  /** Get a weapon base by code (case-insensitive). */
  get(code: string): WeaponBase | undefined
  /** Total count of weapons. */
  readonly length: number
  /** Allows iteration over all weapon bases. */
  [Symbol.iterator](): IterableIterator<WeaponBase>
}

/**
 * Parse a numeric cell value, returning fallback if empty or NaN.
 */
function parseNumber(value: string, fallback = 0): number {
  const trimmed = value.trim()
  if (!trimmed) return fallback
  const n = Number.parseInt(trimmed, 10)
  return Number.isNaN(n) ? fallback : n
}

/**
 * Parse an optional numeric cell value, returning undefined if empty or NaN.
 */
function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const n = Number.parseInt(trimmed, 10)
  return Number.isNaN(n) ? undefined : n
}

/**
 * Reads a column out of a row in a Weapons D2Table safely, avoiding column 18 collision.
 */
export function getWeaponCell(table: D2Table, row: readonly string[], column: string): string {
  if (!column || !column.trim()) return ''
  const target = column.trim().toLowerCase()
  const idx = table.header.findIndex((h, i) => i !== 18 && h.trim().toLowerCase() === target)
  return idx === -1 ? '' : (row[idx] ?? '').trim()
}

/**
 * Parses a Weapons D2Table (or raw bytes/TSV text) into a `WeaponTable`.
 *
 * @param table - the tab-separated D2Table or bytes or string.
 * @returns the parsed WeaponTable.
 */
export function parseWeaponsTable(table: D2Table): WeaponTable
export function parseWeaponsTable(bytes: Uint8Array): WeaponTable
export function parseWeaponsTable(tsv: string): WeaponTable
export function parseWeaponsTable(input: D2Table | Uint8Array | string): WeaponTable {
  let table: D2Table
  if (typeof input === 'string') {
    table = parseTable(new TextEncoder().encode(input))
  } else if (input instanceof Uint8Array) {
    table = parseTable(input)
  } else {
    table = input
  }

  // Map non-empty header column names to their 0-based column index.
  // CAUTION: Column index 18 in vanilla Weapons.txt has an empty header "" (between maxmisdam and rangeadder).
  // We MUST ignore empty headers so empty column lookups never collide with column 18.
  const colIndex = new Map<string, number>()
  for (let i = 0; i < table.header.length; i++) {
    const h = table.header[i]?.trim().toLowerCase()
    if (h && h.length > 0) {
      colIndex.set(h, i)
    }
  }

  const getCell = (row: readonly string[], col: string): string => {
    const key = col.trim().toLowerCase()
    if (!key) return ''
    const idx = colIndex.get(key)
    if (idx === undefined) return ''
    return (row[idx] ?? '').trim()
  }

  const all: WeaponBase[] = []
  const byCode = new CaseInsensitiveMap<WeaponBase>()

  for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
    const row = table.rows[rowIndex]
    if (!row) continue

    const name = getCell(row, 'name')
    const code = getCell(row, 'code')

    // Filter out the 'Expansion' section separator row and rows without a code
    if (name.toLowerCase() === 'expansion' || !code) {
      continue
    }

    const namestr = getCell(row, 'namestr')
    const version = parseNumber(getCell(row, 'version'), 0)
    const spawnable = getCell(row, 'spawnable') === '1'
    const rawRarity = getCell(row, 'rarity')
    // 15 items have empty rarity in 1.13c; they must be parsed as 0 (excluded from auto-TC)
    const rarity = rawRarity ? parseNumber(rawRarity, 0) : 0
    const level = parseNumber(getCell(row, 'level'), 0)
    const levelreq = parseNumber(getCell(row, 'levelreq'), 0)
    const mindam = parseNumber(getCell(row, 'mindam'), 0)
    const maxdam = parseNumber(getCell(row, 'maxdam'), 0)

    const twoHandedMindam = parseOptionalNumber(getCell(row, '2handmindam'))
    const twoHandedMaxdam = parseOptionalNumber(getCell(row, '2handmaxdam'))
    const twoHanded = getCell(row, '2handed') === '1'
    const oneOrTwoHanded = getCell(row, '1or2handed') === '1'

    const minMisDam = parseOptionalNumber(getCell(row, 'minmisdam'))
    const maxMisDam = parseOptionalNumber(getCell(row, 'maxmisdam'))
    const rawMissileType = parseOptionalNumber(getCell(row, 'missiletype'))
    const missiletype = rawMissileType !== undefined && rawMissileType > 0 ? rawMissileType : undefined

    const speed = parseNumber(getCell(row, 'speed'), 0)
    const strBonus = parseNumber(getCell(row, 'strbonus'), 0)
    const dexBonus = parseNumber(getCell(row, 'dexbonus'), 0)
    const reqstr = parseNumber(getCell(row, 'reqstr'), 0)
    const reqdex = parseNumber(getCell(row, 'reqdex'), 0)
    const durability = parseNumber(getCell(row, 'durability'), 0)
    const cost = parseNumber(getCell(row, 'cost'), 0)
    const gambleCost = parseNumber(getCell(row, 'gamble cost'), 0)
    const type = getCell(row, 'type')
    const rawType2 = getCell(row, 'type2')
    const type2 = rawType2 ? rawType2 : undefined
    const wclass = getCell(row, 'wclass')
    const raw2hWClass = getCell(row, '2handedwclass')
    const twoHandedWClass = raw2hWClass ? raw2hWClass : undefined
    const stackable = getCell(row, 'stackable') === '1'
    const minstack = parseOptionalNumber(getCell(row, 'minstack'))
    const maxstack = parseOptionalNumber(getCell(row, 'maxstack'))
    const rangeadder = parseNumber(getCell(row, 'rangeadder'), 0)
    const normcode = getCell(row, 'normcode')
    const ubercode = getCell(row, 'ubercode')
    const ultracode = getCell(row, 'ultracode')
    const gemsockets = parseNumber(getCell(row, 'gemsockets'), 0)
    const invWidth = parseNumber(getCell(row, 'invwidth'), 0)
    const invHeight = parseNumber(getCell(row, 'invheight'), 0)
    const autoPrefix = parseOptionalNumber(getCell(row, 'auto prefix'))
    const parsedMagicLvl = parseOptionalNumber(getCell(row, 'magic lvl'))
    const itemMagicLvl = parsedMagicLvl !== undefined && parsedMagicLvl > 0 ? parsedMagicLvl : undefined
    const tags = type2 ? [type, type2] : [type]
    const damage = maxdam
    const dropsound = getCell(row, 'dropsound') || undefined
    const dropsfxframe = parseOptionalNumber(getCell(row, 'dropsfxframe'))
    const usesound = getCell(row, 'usesound') || undefined

    const nightmareUpgrade = getCell(row, 'nightmareupgrade') || 'xxx'
    const hellUpgrade = getCell(row, 'hellupgrade') || 'xxx'
    const permStoreItem = getCell(row, 'permstoreitem') === '1'
    const multibuy = getCell(row, 'multibuy') === '1'
    const bitfield1 = parseNumber(getCell(row, 'bitfield1'), 0)
    const quest = parseNumber(getCell(row, 'quest'), 0)
    const questDiffCheck = getCell(row, 'questdiffcheck') === '1'

    const alternateGfx = (getCell(row, 'alternategfx') || code).toLowerCase()
    const alternategfx = alternateGfx
    const component = parseNumber(getCell(row, 'component'), 16)
    // D2Common.dll DATATBLS_LoadItemsTxt (0x6fdca75d..0x6fdca7a8) & ITEMS_GetColor (0x6fd755a6..0x6fd755df):
    // - 'Transform' (+0x141, Weapons.txt @159): 3D character paperdoll palette shift table (0..8, e.g. oba=5 greybrown.dat, 7gd=1 grey.dat).
    // - 'InvTrans' (+0x142, Weapons.txt @160): 2D inventory/flippy icon palette shift table (0..8, e.g. oba=8 invgreybrown.dat, 7gd=2 grey2.dat).
    const transform = parseNumber(getCell(row, 'transform'), 0)
    const invTrans = parseNumber(getCell(row, 'invtrans'), 0)

    const vendorColumns: Record<number, VendorItemColumns> = {}
    for (let vId = 0; vId < VENDOR_COUNT; vId++) {
      const prefix = VENDOR_COLUMN_PREFIXES[vId]!
      const min = parseNumber(getCell(row, `${prefix}min`), 0)
      const max = parseNumber(getCell(row, `${prefix}max`), 0)
      const magicMin = parseNumber(getCell(row, `${prefix}magicmin`), 0)
      const magicMax = parseNumber(getCell(row, `${prefix}magicmax`), 0)
      const magicLvl = parseNumber(getCell(row, `${prefix}magiclvl`), 0)
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

    const weapon: WeaponBase = {
      id: code,
      code,
      name,
      namestr,
      version,
      kind: 'weapon',
      spawnable,
      rarity,
      level,
      levelreq,
      mindam,
      maxdam,
      ...(twoHandedMindam !== undefined ? { twoHandedMindam } : {}),
      ...(twoHandedMaxdam !== undefined ? { twoHandedMaxdam } : {}),
      twoHanded,
      oneOrTwoHanded,
      strBonus,
      dexBonus,
      ...(minMisDam !== undefined ? { minMisDam } : {}),
      ...(maxMisDam !== undefined ? { maxMisDam } : {}),
      ...(missiletype !== undefined ? { missiletype } : {}),
      speed,
      reqstr,
      reqdex,
      durability,
      cost,
      gambleCost,
      type,
      ...(type2 !== undefined ? { type2 } : {}),
      wclass,
      ...(twoHandedWClass !== undefined ? { twoHandedWClass } : {}),
      stackable,
      ...(minstack !== undefined ? { minstack } : {}),
      ...(maxstack !== undefined ? { maxstack } : {}),
      rangeadder,
      normcode,
      ubercode,
      ultracode,
      gemsockets,
      invWidth,
      invHeight,
      tags,
      damage,
      value: cost,
      defense: 0,
      maxStack: maxstack ?? 1,
      ...(autoPrefix !== undefined && autoPrefix > 0 ? { autoPrefix } : {}),
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
      alternateGfx,
      alternategfx,
      component,
      transform,
      invTrans,
    }

    all.push(weapon)
    byCode.set(code, weapon)
  }

  return {
    byCode,
    all,
    get: (code: string) => byCode.get(code),
    get length() {
      return all.length
    },
    [Symbol.iterator]: () => all[Symbol.iterator](),
  }
}

/**
 * Loads and parses `Weapons.txt` from mounted MPQ archives.
 *
 * @param archives - Mounted MPQ archives.
 * @returns Promise resolving to `WeaponTable`.
 */
export async function loadWeapons(archives: MountedArchives): Promise<WeaponTable> {
  const candidatePaths = [
    WEAPONS_TABLE_PATH,
    'data/global/excel/Weapons.txt',
    'data\\global\\excel\\weapons.txt',
    'data/global/excel/weapons.txt',
  ]
  let bytes: Uint8Array | undefined
  for (const p of candidatePaths) {
    if (archives.has(p)) {
      bytes = await archives.read(p)
      break
    }
  }
  if (!bytes) {
    bytes = await archives.read(WEAPONS_TABLE_PATH)
  }
  return parseWeaponsTable(parseTable(bytes))
}
