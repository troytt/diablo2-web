/**
 * 1.13c Diablo II Item Drop Pipeline.
 *
 * Complete implementation of the real TreasureClassEx drop tree, replacing
 * synthetic rollDrop and deleting demo item bases and affixes.
 *
 * Gold standard entry flow (D2Game!6FC32D60):
 * - nLevel = monster.level
 * - tcName = monStats.getTreasureClass(difficulty, monsterType)
 * - Top-level TC group upgrade: resolveTreasureClassGroup(tcTable, tcName, nLevel)
 * - Expand TC tree using expandTreasureClass (from rollTreasureClass)
 * - For each rolled leaf item:
 *   * Gold: calculate scaled gold amount and emit goldItem(amount).
 *   * Base item:
 *     - Lookup base in weapons/armor/misc via dropTables.getBase(code).
 *     - Base upgrade: upgradeItemBase(base, qf4, qf5, rng, dropTables.getBase).
 *     - Init item seed: dwInitSeed = (rng.rand(0xFFFFFFFF) >>> 0), itemRng = new D2Rng(dwInitSeed).
 *     - ItemRatio quality roll using rollItemQuality.
 *     - Quality branches:
 *       * Unique: lookup eligible enabled uniques (lvl <= nLevel). Fallback if empty: Rare + 3x durability.
 *       * Set: lookup eligible set items (lvl <= nLevel). Fallback if empty: Magic + 2x durability.
 *       * Rare: rollRareAffixes.
 *       * Magic: rollMagicAffixes.
 *       * Superior / Normal / Low: standard base.
 */

import type { MountedArchives } from '../mpq/mount.ts'
import { parseTable } from '../world/acts.ts'
import type { D2Table } from '../world/acts.ts'
import { D2Rng, Rng } from '../rng/d2-rng.ts'
import {
  type TreasureClassTable,
  type TreasureClassNode,
  loadTreasureClasses,
  resolveTreasureClassGroup,
} from './treasure-class.ts'
import {
  expandTreasureClass,
  MAX_DROPPED_ITEMS,
  type DroppedItemEntry,
} from './treasure-engine.ts'
import {
  type WeaponTable,
  loadWeapons,
} from './weapons.ts'
import {
  type ArmorTable,
  loadArmor,
} from './armor.ts'
import {
  type MiscTable,
  loadMisc,
} from './misc-items.ts'
import {
  type ItemRatioTable,
  loadItemRatio,
  rollItemQuality,
  type ItemQualityTier,
  QUALITY_TIER_TO_ITEM_QUALITY,
} from './item-ratio.ts'
import {
  type DifficultyLevelTable,
  loadDifficultyLevels,
  type DifficultyLevelOdds,
  upgradeItemBase,
} from './item-upgrade.ts'
import {
  type UniqueItemsTable,
  loadUniqueItems,
  type UniqueItem,
} from './unique-items.ts'
import {
  type SetTable,
  type SetItemTable,
  loadSetData,
  type SetItem,
} from './set-items.ts'
import {
  type AffixTable,
  loadMagicAffixes,
  inferItemClassFromType,
} from './affixes.ts'
import {
  type RareNameTable,
  loadRareNames,
} from './rare-names.ts'
import {
  type ItemTypeTable,
  loadItemTypes,
  isA,
} from './item-types.ts'
import {
  generateAutoTreasureClasses,
  autoTcToTreasureClassNode,
} from './auto-tc.ts'
import {
  type Item,
  type ItemBase,
  type ItemAffixSlot,
  ItemQuality,
  goldItem,
  ItemFlag,
  decodeItemFlags,
  formatItemCode,
  type RolledItemProp,
} from './items.ts'
import {
  type MonsterKind,
  readMonsterKinds,
  getMonsterTreasureClass,
  type Difficulty,
  readSuperUniques,
  type SuperUnique,
} from '../units/monsters-data.ts'
export type { Difficulty } from '../units/monsters-data.ts'
import {
  rollMagicAffixes,
  rollRareAffixes,
  getItemTypeCode,
  NON_RANDOM_RANGE_CODES,
  type GeneratedAffixes,
  type GeneratedRareAffixes,
} from './affix-generator.ts'
import {
  type AutoMagicTable,
  loadAutoMagic,
  CANONICAL_AUTOMAGIC_TABLE,
  rollAutoMagic,
  type RolledAutoMagic,
  type RolledAutoMagicMod,
  resolveAutoPrefixGroup,
  ITEM_TYPE_AUTO_PREFIX_MAP,
  rollStaffMods,
  resolveStaffModsClass,
  ITEM_TYPE_STAFF_MODS_MAP,
  STAFF_MOD_CLASS_SKILL_START,
} from './automagic.ts'
import {
  loadItemPropertiesAndStats,
  type PropertiesTable,
  type ItemStatCostTable,
} from './properties.ts'
import { setRuntimePropertyTables } from './item-tooltip.ts'
import {
  translateItemName,
  translateMagicName,
  translateRareName,
  resolveBaseItemNameEn,
  resolveRareNameEn,
  resolveMagicNameEn,
} from '../i18n/tooltip-i18n.ts'
import type { NpcTable, BooksTable, SkillCostMap } from '../units/npc-table.ts'
import { getEmbeddedDropTables } from './embedded-drop-tables.ts'

export {
  rollAutoMagic,
  type RolledAutoMagic,
  type RolledAutoMagicMod,
  resolveAutoPrefixGroup,
  ITEM_TYPE_AUTO_PREFIX_MAP,
  rollStaffMods,
  resolveStaffModsClass,
  ITEM_TYPE_STAFF_MODS_MAP,
  STAFF_MOD_CLASS_SKILL_START,
}

/**
 * Complete collection of parsed game data tables required for the drop pipeline.
 */
export interface DropTables {
  readonly tcTable: TreasureClassTable
  readonly autoTcTable: Map<string, TreasureClassNode>
  readonly weapons: WeaponTable
  readonly armor: ArmorTable
  readonly misc: MiscTable
  readonly itemRatio: ItemRatioTable
  readonly difficultyLevels: DifficultyLevelTable
  readonly difficultyOdds: Map<string, DifficultyLevelOdds>
  readonly uniques: UniqueItemsTable
  readonly sets: { readonly items: SetItemTable; readonly sets: SetTable }
  readonly magicAffixes: { readonly prefixes: AffixTable; readonly suffixes: AffixTable }
  readonly rareNames: { readonly prefixes: RareNameTable; readonly suffixes: RareNameTable }
  readonly autoMagic?: AutoMagicTable | undefined
  readonly properties?: PropertiesTable | undefined
  readonly itemStatCost?: ItemStatCostTable | undefined
  readonly npcTable?: NpcTable | undefined
  readonly gambleCodes?: readonly string[] | undefined
  readonly booksTable?: BooksTable | undefined
  readonly lowQualityItems?: readonly string[] | undefined
  readonly skillCosts?: SkillCostMap | undefined
  readonly itemTypes: ItemTypeTable
  readonly monsterKinds: Map<string, MonsterKind>
  readonly superUniques: Map<string, SuperUnique>
  readonly isA: (type: string, target: string) => boolean
  readonly getBase: (code: string) => ItemBase | undefined
}

/**
 * Loads all data tables required by the drop pipeline from mounted MPQ archives.
 * Fails loudly with an Error if required files or tables are missing.
 *
 * @param archives - Mounted MPQ archives.
 * @returns Promise resolving to DropTables.
 */
export async function loadDropTables(archives: MountedArchives): Promise<DropTables> {
  const [
    tcTable,
    weapons,
    armor,
    misc,
    itemRatio,
    difficultyLevels,
    uniques,
    sets,
    magicAffixes,
    rareNames,
    itemTypes,
    monstatsBytes,
    propAndStats,
  ] = await Promise.all([
    loadTreasureClasses(archives),
    loadWeapons(archives),
    loadArmor(archives),
    loadMisc(archives),
    loadItemRatio(archives),
    loadDifficultyLevels(archives),
    loadUniqueItems(archives),
    loadSetData(archives),
    loadMagicAffixes(archives),
    loadRareNames(archives),
    loadItemTypes(archives),
    archives.read('data\\global\\excel\\monstats.txt'),
    loadItemPropertiesAndStats(archives),
  ])

  const { properties, itemStatCost } = propAndStats
  setRuntimePropertyTables(properties, itemStatCost)

  let autoMagic: AutoMagicTable
  try {
    autoMagic = await loadAutoMagic(archives)
  } catch (err) {
    throw new Error(
      `Failed to load AutoMagic.txt: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  const rawAutoTcTable = generateAutoTreasureClasses(itemTypes, armor, weapons)
  const autoTcTable = new Map<string, TreasureClassNode>()
  for (const [key, node] of rawAutoTcTable) {
    autoTcTable.set(key, autoTcToTreasureClassNode(node))
  }

  const isAPredicate = (type: string, target: string): boolean => isA(type, target, itemTypes)

  const getBase = (code: string): ItemBase | undefined => {
    return weapons.get(code) ?? armor.get(code) ?? misc.get(code)
  }

  const monstatsTable: D2Table = parseTable(monstatsBytes)
  const monsterKinds = readMonsterKinds(monstatsTable)

  const superUniques = new Map<string, SuperUnique>()
  let suBytes: Uint8Array
  try {
    suBytes = await archives.read('data\\global\\excel\\SuperUniques.txt')
  } catch (err) {
    throw new Error(
      `Failed to load SuperUniques.txt: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
  const suList = readSuperUniques(parseTable(suBytes))
  for (const su of suList) {
    superUniques.set(su.id, su)
  }

  return {
    tcTable,
    autoTcTable,
    weapons,
    armor,
    misc,
    itemRatio,
    difficultyLevels,
    difficultyOdds: difficultyLevels.byName,
    uniques,
    sets,
    magicAffixes,
    rareNames,
    autoMagic,
    properties,
    itemStatCost,
    itemTypes,
    monsterKinds,
    superUniques,
    isA: isAPredicate,
    getBase,
  }
}

/**
 * Options for executing the TreasureClass drop pipeline.
 */
export interface DropPipelineOptions {
  /** Top-level TreasureClass name (e.g. 'Act 1 H2H A', 'Act 1 Champ A'). */
  readonly tcName: string
  /** Monster level (or area level) used for group upgrade and ilvl. */
  readonly nLevel?: number | undefined
  /** Alias for `nLevel` used by 1-arg callers. */
  readonly mlvl?: number | undefined
  /** Monster type: 1 = Normal, 2 = Champion, 3 = Unique, 4 = Boss / Quest. */
  readonly monsterType?: number | undefined
  /** Monster drop RNG instance or seed. */
  readonly monsterRng?: D2Rng | Rng | number | undefined
  /** Alias for `monsterRng` used by 1-arg callers. */
  readonly seed?: D2Rng | Rng | number | undefined
  /** Player Magic Find percentage (e.g. 50 = +50% MF). */
  readonly playerMf?: number | undefined
  /** Alias for playerMf used by parity test suites. */
  readonly magicFind?: number | undefined
  /** Player Gold Find percentage (e.g. 100 = +100% GF). */
  readonly playerGf?: number | undefined
  /** Whether monster is a boss (never upgrades TC). */
  readonly isBoss?: boolean | undefined
  /** Whether monster is a summon/minion with noRatio (never upgrades TC). */
  readonly isNoRatio?: boolean | undefined
  /** Game difficulty. */
  readonly difficulty?: Difficulty | undefined
  /** Total players in game (for NoDrop scaling). */
  readonly gamePlayers?: number | undefined
  /** Alias for gamePlayers used by parity test suites. */
  readonly playerCount?: number | undefined
  /** Nearby party members (for NoDrop scaling). */
  readonly partyPlayers?: number | undefined
  /** Whether Expansion items and runes are enabled (default: true). */
  readonly isExpansion?: boolean | undefined
  /** Maximum items emitted per drop roll (default: MAX_DROPPED_ITEMS = 6). */
  readonly maxDrops?: number | undefined
  /** Optional forced item quality tier (`D2GAME_DropTreasureClass` `nQuality` 1..7 or tier name, e.g. Sparkling Chest). */
  readonly forcedQuality?: ItemQualityTier | number | undefined
  /** Parsed drop tables (defaults to `getEmbeddedDropTables()` when omitted in 1-arg form). */
  readonly dropTables?: DropTables | undefined
  /** Alias for `dropTables` used by 1-arg callers. */
  readonly registry?: DropTables | object | undefined
}

/**
 * Checks whether an item base can spawn as Rare in Diablo II 1.13c.
 *
 * Ground truth rules (ItemTypes.txt & D2Common.dll):
 * - Charms (cm1, cm2, cm3 / 'char') NEVER spawn as Rare.
 * - Items with `rare === false` in ItemTypes.txt cannot be Rare.
 * - Items with `normal === true` in ItemTypes.txt (potions, scrolls, runes, gems, keys) cannot be Rare.
 * - Weapons, Armor, Rings, Amulets, Jewels CAN spawn as Rare.
 */
export function canItemBeRare(
  base: ItemBase,
  itemTypes?: ItemTypeTable,
  isAPredicate?: Function,
): boolean {
  if (base.id === 'cm1' || base.id === 'cm2' || base.id === 'cm3') {
    return false
  }
  const typeCode = getItemTypeCode(base).toLowerCase()
  if (typeCode === 'char' || typeCode === 'cm1' || typeCode === 'cm2' || typeCode === 'cm3' || typeCode === 'scha' || typeCode === 'mcha' || typeCode === 'lcha') {
    return false
  }
  if (isAPredicate && (isAPredicate(typeCode, 'char') || isAPredicate(typeCode, 'cm1') || isAPredicate(typeCode, 'cm2') || isAPredicate(typeCode, 'cm3'))) {
    return false
  }
  if (itemTypes) {
    const def = itemTypes.byCode.get(typeCode)
    if (def) {
      if (def.charm || !def.rare || def.normal) {
        return false
      }
    }
  }
  return true
}

/**
 * Resolved ItemTypes.txt quality and class flags for an item base (D2 1.13c Ground Truth).
 */
export interface ItemTypeFlags {
  readonly isNormalOnly: boolean
  readonly isAlwaysMagic: boolean
  readonly canBeRare: boolean
  readonly isClassSpecific: boolean
  readonly itemClass: string
}

const ALWAYS_MAGIC_BASE_IDS = new Set(['rin', 'amu', 'jew', 'cm1', 'cm2', 'cm3'])
const ALWAYS_MAGIC_TYPE_CODES = new Set(['ring', 'amul', 'jewl', 'char', 'scha', 'mcha', 'lcha', 'mboq', 'mxbq'])
const CLASS_SPECIFIC_TYPE_CODES = new Set([
  'clas',
  'amaz',
  'barb',
  'necr',
  'pala',
  'sorc',
  'assn',
  'drui',
  'abow',
  'aspe',
  'ajav',
  'orb',
  'head',
  'voodoo',
  'ashd',
  'phlm',
  'pelt',
  'cloa',
  'h2h',
  'h2h2',
])

/**
 * Resolves quality availability and class-specific flags from `ItemTypes.txt` for a given item base.
 *
 * Ground truth rules (ItemTypes.txt & D2Game!6FC2FC40):
 * - `isNormalOnly`: `def.normal === true` (and not ring/amu/jew/cm1..3/equippable weapon/armor).
 * - `isAlwaysMagic`: `def.magic === true` or `base.id` in `rin`/`amu`/`jew`/`cm1`/`cm2`/`cm3`.
 *   Minimum quality for these items is always Magic (never Superior/Normal/Low).
 * - `canBeRare`: delegates to `canItemBeRare(base, itemTypes, isAPredicate)`.
 * - `isClassSpecific`: `def.class !== ''` or any `equiv1`/`equiv2` ancestor has `class !== ''`.
 * - `itemClass`: First non-empty `def.class` along the `equiv1`/`equiv2` parent chain (or inferred via `isA`), '' for generic items.
 */
export function resolveItemTypeFlags(
  base: ItemBase,
  itemTypes?: ItemTypeTable,
  isAPredicate?: (type: string, target: string) => boolean,
): ItemTypeFlags {
  const baseId = (base.id ?? '').trim().toLowerCase()
  const typeCode = getItemTypeCode(base).trim().toLowerCase()
  const def = itemTypes?.byCode.get(typeCode)

  const isAlwaysMagic = Boolean(
    def?.magic ||
      def?.charm ||
      ALWAYS_MAGIC_BASE_IDS.has(baseId) ||
      ALWAYS_MAGIC_TYPE_CODES.has(typeCode),
  )

  const isEquippableWeaponOrArmor =
    (base.kind === 'weapon' || base.kind === 'armor') &&
    typeCode !== 'tpot' &&
    typeCode !== 'bowq' &&
    typeCode !== 'xboq'

  const isNormalOnly = !isAlwaysMagic && !isEquippableWeaponOrArmor && Boolean(def ? def.normal : true)

  const canBeRare = canItemBeRare(base, itemTypes, isAPredicate)

  let itemClass = ''
  const rawBaseClass = (base as any).itemClass ?? (base as any).class
  if (typeof rawBaseClass === 'string' && rawBaseClass.trim() !== '') {
    itemClass = rawBaseClass.trim().toLowerCase()
  }

  let isClassSpecific = Boolean(itemClass) || CLASS_SPECIFIC_TYPE_CODES.has(typeCode)
  if (itemTypes) {
    const visited = new Set<string>()
    const queue: string[] = [typeCode]
    while (queue.length > 0) {
      const curr = queue.shift()!.trim().toLowerCase()
      if (!curr || visited.has(curr)) continue
      visited.add(curr)
      if (CLASS_SPECIFIC_TYPE_CODES.has(curr)) {
        isClassSpecific = true
      }
      const currDef = itemTypes.byCode.get(curr)
      if (!currDef) continue
      if (currDef.class && currDef.class.trim() !== '') {
        isClassSpecific = true
        if (!itemClass) {
          itemClass = currDef.class.trim().toLowerCase()
        }
        break
      }
      if (currDef.equiv1) queue.push(currDef.equiv1)
      if (currDef.equiv2) queue.push(currDef.equiv2)
    }
  }
  if (!itemClass) {
    itemClass = inferItemClassFromType(typeCode, isAPredicate)
    if (itemClass) {
      isClassSpecific = true
    }
  }
  if (!isClassSpecific && isAPredicate) {
    if (isAPredicate(typeCode, 'clas')) {
      isClassSpecific = true
    }
  }

  return {
    isNormalOnly,
    isAlwaysMagic,
    canBeRare,
    isClassSpecific,
    itemClass,
  }
}

/**
 * Canonical 1.13c Low Quality prefixes (4 subtypes: 0..3).
 */
export const LOW_QUALITY_PREFIXES = ['Low Quality', 'Cracked', 'Crude', 'Damaged'] as const

export interface EtherealAndSocketsRoll {
  readonly ethereal: boolean
  readonly sockets: number
}

/**
 * Rolls Ethereal status (1/20 chance) and Socket count (1/3 chance for normal/superior/low)
 * according to Diablo II 1.13c rules (D2Game!6FC30090).
 */
export function rollItemEtherealAndSockets(
  base: ItemBase,
  qualityTier: ItemQualityTier,
  ilvl: number,
  itemRng: D2Rng,
  options?: {
    readonly uniqueItem?: UniqueItem | undefined
    readonly itemTypes?: ItemTypeTable | undefined
    readonly rolledProps?: readonly RolledItemProp[] | undefined
  },
): EtherealAndSocketsRoll {
  let ethereal = false
  let sockets = 0

  const isWeaponOrArmor = base.kind === 'weapon' || base.kind === 'armor'
  const rawDur = Number((base as any).durability) || 0
  const noDur = Boolean((base as any).nodurability) || Boolean((base as any).indestructible)

  const hasFixedIndestruct = Boolean(
    options?.uniqueItem?.props.some(p => p.code.trim().toLowerCase() === 'indestruct') ||
      options?.rolledProps?.some(p => p.code.trim().toLowerCase() === 'indestruct'),
  )
  const hasFixedEthereal = Boolean(
    options?.uniqueItem?.props.some(p => p.code.trim().toLowerCase() === 'ethereal') ||
      options?.rolledProps?.some(p => p.code.trim().toLowerCase() === 'ethereal'),
  )

  if (hasFixedEthereal) {
    ethereal = true
  } else if (isWeaponOrArmor && rawDur > 0 && !noDur && qualityTier !== 'set' && !hasFixedIndestruct) {
    if (itemRng.rand(20) === 0) {
      ethereal = true
    }
  }

  if (
    isWeaponOrArmor &&
    (qualityTier === 'normal' || qualityTier === 'superior' || qualityTier === 'low')
  ) {
    const baseMaxSockets = Number((base as any).gemsockets) || 0
    if (baseMaxSockets > 0) {
      const typeCode = getItemTypeCode(base).trim().toLowerCase()
      const def = options?.itemTypes?.byCode.get(typeCode)
      const typeMaxSockets = def
        ? ilvl >= 40
          ? def.maxSock40
          : ilvl >= 25
            ? def.maxSock25
            : def.maxSock1
        : baseMaxSockets
      const maxAllowedSockets = Math.min(baseMaxSockets, typeMaxSockets)
      if (maxAllowedSockets > 0 && itemRng.rand(3) === 0) {
        sockets = itemRng.randRange(1, maxAllowedSockets)
      }
    }
  }

  return { ethereal, sockets }
}

/**
 * Per 1.13c D2Game.dll (ITEMS_Create / 0x6FC2FC40):
 * - Low Quality (1), Normal (2), Superior (3), and Quest items (quest > 0) spawn identified.
 * - Magic (4), Set (5), Rare (6), Unique (7), and Crafted (8) non-quest items spawn unidentified on drop.
 */
export function shouldSpawnIdentifiedByDefault(
  base: ItemBase,
  qualityTier: ItemQualityTier,
): boolean {
  if ((base.quest ?? 0) > 0) {
    return true
  }
  return qualityTier === 'low' || qualityTier === 'normal' || qualityTier === 'superior'
}

/**
 * Creates a concrete Item instance for a dropped leaf item.
 */
export function createDroppedItem(
  base: ItemBase,
  qualityTier: ItemQualityTier,
  options: {
    readonly uniqueItem?: UniqueItem | undefined
    readonly setItem?: SetItem | undefined
    readonly magicAffixes?: GeneratedAffixes | undefined
    readonly rareAffixes?: GeneratedRareAffixes | undefined
    readonly autoMagicAffix?: RolledAutoMagic | null | undefined
    readonly staffMods?: readonly RolledItemProp[] | undefined
    readonly rolledProps?: readonly RolledItemProp[] | undefined
    readonly ethereal?: boolean | undefined
    readonly sockets?: number | undefined
    readonly itemTypes?: ItemTypeTable | undefined
    readonly ilvl: number
    readonly dwInitSeed: number
    readonly durabilityMultiplier?: number | undefined
    readonly itemRng?: D2Rng | undefined
    readonly identified?: boolean | undefined
  },
): Item {
  const quality = QUALITY_TIER_TO_ITEM_QUALITY[qualityTier] ?? ItemQuality.NORMAL
  const isIdentified = options.identified ?? shouldSpawnIdentifiedByDefault(base, qualityTier)
  let rawFlags = isIdentified ? ItemFlag.IDENTIFIED : 0

  let name = base.name
  let prefix = null
  let suffix = null
  let qualitySubtype: number | undefined = undefined
  const stats: Record<string, number> = {}
  const rolledProps: RolledItemProp[] = []

  if (base.damage > 0) stats.damage = base.damage
  if (base.defense > 0) stats.defense = base.defense

  const propRng = options.itemRng ?? new D2Rng(options.dwInitSeed)

  const resolveItemPropValue = (prop: { code: string; par?: string | number; min: number; max: number }): number => {
    const codeLower = prop.code.toLowerCase()
    if (NON_RANDOM_RANGE_CODES.has(codeLower)) {
      return prop.min
    }
    if (prop.min === prop.max) {
      return prop.min
    }
    return propRng.randRange(prop.min, prop.max)
  }

  if (options.rolledProps && options.rolledProps.length > 0) {
    for (const p of options.rolledProps) {
      rolledProps.push(p)
      stats[p.code] = (stats[p.code] ?? 0) + p.value
    }
  }

  if (qualityTier === 'unique' && options.uniqueItem) {
    name = options.uniqueItem.index
    if (!options.rolledProps || options.rolledProps.length === 0) {
      for (const prop of options.uniqueItem.props) {
        if (prop.code) {
          const val = resolveItemPropValue(prop)
          rolledProps.push({
            code: prop.code,
            param: prop.par,
            min: prop.min,
            max: prop.max,
            value: val,
          })
          stats[prop.code] = (stats[prop.code] ?? 0) + val
        }
      }
    }
  } else if (qualityTier === 'set' && options.setItem) {
    name = options.setItem.index
    if (!options.rolledProps || options.rolledProps.length === 0) {
      for (const prop of options.setItem.props) {
        if (prop.code) {
          const val = resolveItemPropValue(prop)
          rolledProps.push({
            code: prop.code,
            param: prop.par,
            min: prop.min,
            max: prop.max,
            value: val,
          })
          stats[prop.code] = (stats[prop.code] ?? 0) + val
        }
      }
    }
  } else if (qualityTier === 'rare' && options.rareAffixes) {
    name = options.rareAffixes.name
    for (const affix of options.rareAffixes.affixes) {
      for (const mod of affix.mods) {
        rolledProps.push({
          code: mod.code,
          param: mod.param,
          min: mod.min,
          max: mod.max,
          value: mod.value,
        })
        stats[mod.code] = (stats[mod.code] ?? 0) + mod.value
      }
    }
  } else if (qualityTier === 'magic' && options.magicAffixes) {
    name = options.magicAffixes.name
    if (options.magicAffixes.prefix) {
      const p = options.magicAffixes.prefix
      prefix = {
        id: p.affix.name,
        name: p.name,
        kind: 'prefix' as const,
        level: p.level,
        itemTypes: p.affix.itypes,
        modifiers: p.mods.map(m => ({ stat: m.code, min: m.min, max: m.max })),
      }
      for (const mod of p.mods) {
        rolledProps.push({
          code: mod.code,
          param: mod.param,
          min: mod.min,
          max: mod.max,
          value: mod.value,
        })
        stats[mod.code] = (stats[mod.code] ?? 0) + mod.value
      }
    }
    if (options.magicAffixes.suffix) {
      const s = options.magicAffixes.suffix
      suffix = {
        id: s.affix.name,
        name: s.name,
        kind: 'suffix' as const,
        level: s.level,
        itemTypes: s.affix.itypes,
        modifiers: s.mods.map(m => ({ stat: m.code, min: m.min, max: m.max })),
      }
      for (const mod of s.mods) {
        rolledProps.push({
          code: mod.code,
          param: mod.param,
          min: mod.min,
          max: mod.max,
          value: mod.value,
        })
        stats[mod.code] = (stats[mod.code] ?? 0) + mod.value
      }
    }
  } else if (qualityTier === 'superior') {
    name = `Superior ${base.name}`
    if (!options.rolledProps || options.rolledProps.length === 0) {
      if (base.kind === 'armor') {
        const acPct = propRng.randRange(5, 15)
        rolledProps.push({
          code: 'ac%',
          min: 5,
          max: 15,
          value: acPct,
        })
        stats['ac%'] = (stats['ac%'] ?? 0) + acPct
        if (propRng.rand(2) === 0) {
          const durPct = propRng.randRange(10, 15)
          rolledProps.push({
            code: 'dur%',
            min: 10,
            max: 15,
            value: durPct,
          })
          stats['dur%'] = (stats['dur%'] ?? 0) + durPct
        }
      } else if (base.kind === 'weapon') {
        const dmgPct = propRng.randRange(5, 15)
        rolledProps.push({
          code: 'dmg%',
          min: 5,
          max: 15,
          value: dmgPct,
        })
        stats['dmg%'] = (stats['dmg%'] ?? 0) + dmgPct
        if (propRng.rand(2) === 0) {
          const attVal = propRng.randRange(1, 3)
          rolledProps.push({
            code: 'att',
            min: 1,
            max: 3,
            value: attVal,
          })
          stats['att'] = (stats['att'] ?? 0) + attVal
        }
      }
    }
  } else if (qualityTier === 'low') {
    qualitySubtype = propRng.rand(4)
    const lowPrefix = LOW_QUALITY_PREFIXES[qualitySubtype] ?? 'Cracked'
    name = `${lowPrefix} ${base.name}`
  }

  let effectiveAutoMagic = options.autoMagicAffix
  if (effectiveAutoMagic === undefined && qualityTier !== 'unique' && qualityTier !== 'set') {
    const autoPrefixGroup = resolveAutoPrefixGroup(base)
    if (autoPrefixGroup !== undefined && autoPrefixGroup > 0) {
      effectiveAutoMagic = rollAutoMagic(
        base,
        options.ilvl,
        CANONICAL_AUTOMAGIC_TABLE,
        (a, b) => a === b,
        propRng,
        { group: autoPrefixGroup, isRare: qualityTier === 'rare' },
      )
    }
  }

  if (qualityTier !== 'unique' && qualityTier !== 'set') {
    if (effectiveAutoMagic) {
      for (const mod of effectiveAutoMagic.mods) {
        rolledProps.push({
          code: mod.code,
          param: mod.param,
          min: mod.min,
          max: mod.max,
          value: mod.value,
        })
        stats[mod.code] = (stats[mod.code] ?? 0) + mod.value
      }
    }
    if (options.staffMods && options.staffMods.length > 0) {
      for (const sm of options.staffMods) {
        rolledProps.push({
          code: sm.code,
          param: sm.param,
          min: sm.min,
          max: sm.max,
          value: sm.value,
        })
        stats[sm.code] = (stats[sm.code] ?? 0) + sm.value
      }
    }
  }

  const isEthereal = Boolean(
    options.ethereal || rolledProps.some(p => p.code.trim().toLowerCase() === 'ethereal'),
  )
  const propSockets = rolledProps.reduce(
    (max, p) => (p.code.trim().toLowerCase() === 'sock' ? Math.max(max, p.value) : max),
    0,
  )
  const maxBaseSockets = (base as any).gemsockets ?? (base as any).gemSockets
  const unclampedSockets = Math.max(
    options.sockets !== undefined && options.sockets > 0 ? options.sockets : 0,
    propSockets,
  )
  const socketCount =
    typeof maxBaseSockets === 'number' && maxBaseSockets > 0
      ? Math.min(unclampedSockets, maxBaseSockets)
      : unclampedSockets

  if (isEthereal) {
    rawFlags |= ItemFlag.ETHEREAL
    stats.ethereal = 1
  }
  if (socketCount > 0) {
    rawFlags |= ItemFlag.SOCKETED
  }

  const rawDurability = (base as any).durability ?? 0
  const mult = options.durabilityMultiplier ?? 1
  let durability: number | undefined = undefined
  let maxDurability: number | undefined = undefined

  if (typeof rawDurability === 'number' && rawDurability > 0) {
    if (qualityTier === 'low') {
      maxDurability = Math.max(1, Math.floor(rawDurability / 3))
    } else {
      maxDurability = Math.round(rawDurability * mult)
    }
    durability = maxDurability
  }

  const baseCode = formatItemCode(base.id).trim()
  const resolvedBaseEn = resolveBaseItemNameEn(base.name, baseCode)
  let nameZh: string
  if (qualityTier === 'unique' && options.uniqueItem) {
    nameZh = translateItemName(options.uniqueItem.index)
  } else if (qualityTier === 'set' && options.setItem) {
    nameZh = translateItemName(options.setItem.index)
  } else if (qualityTier === 'rare' && options.rareAffixes) {
    name = resolveRareNameEn(
      options.rareAffixes.name,
      options.rareAffixes.rarePrefix?.name,
      options.rareAffixes.rareSuffix?.name,
    )
    nameZh = translateRareName(
      options.rareAffixes.name,
      options.rareAffixes.rarePrefix?.name,
      options.rareAffixes.rareSuffix?.name,
    )
  } else if (qualityTier === 'magic' && options.magicAffixes) {
    name = resolveMagicNameEn(
      options.magicAffixes.name,
      base.name,
      options.magicAffixes.prefix?.name,
      options.magicAffixes.suffix?.name,
      baseCode,
    )
    nameZh = translateMagicName(
      options.magicAffixes.name,
      base.name,
      options.magicAffixes.prefix?.name,
      options.magicAffixes.suffix?.name,
      baseCode,
    )
  } else if (qualityTier === 'superior') {
    name = `Superior ${resolvedBaseEn}`
    nameZh = translateItemName(name, baseCode)
  } else if (qualityTier === 'low') {
    const lowPrefix = LOW_QUALITY_PREFIXES[qualitySubtype ?? 0] ?? 'Cracked'
    name = `${lowPrefix} ${resolvedBaseEn}`
    nameZh = translateItemName(name, baseCode)
  } else {
    name = resolvedBaseEn
    nameZh = translateItemName(name, baseCode)
  }

  // 1.13c item init rolls the stack size for stackable bases (arrows/bolts/throwing weapons).
  // Keep it seeded from dwInitSeed so the same drop reproduces the same quantity.
  const stackBase = base as ItemBase & { readonly stackable?: boolean; readonly minstack?: number; readonly maxstack?: number; readonly maxStack?: number }
  const maxStack = Number(stackBase.maxstack ?? stackBase.maxStack ?? 1) || 1
  const minStack = Math.max(1, Number(stackBase.minstack ?? 1) || 1)
  const stack = stackBase.stackable === true && maxStack > 1
    ? propRng.randRange(Math.min(minStack, maxStack), maxStack)
    : 1

  return {
    base,
    prefix,
    suffix,
    level: options.ilvl,
    ilvl: options.ilvl,
    itemLevel: options.ilvl,
    name,
    nameZh,
    stats,
    invWidth: base.invWidth,
    invHeight: base.invHeight,
    stack,
    value: base.value,
    rawFlags,
    flags: decodeItemFlags(rawFlags),
    identified: isIdentified,
    version: 0x65,
    code: formatItemCode(base.id),
    quality,
    rarity: qualityTier,
    uniqueId: options.dwInitSeed,
    durability,
    maxDurability,
    ...(qualitySubtype !== undefined ? { qualitySubtype } : {}),
    ...(isEthereal ? { ethereal: true } : {}),
    ...(socketCount > 0 ? { sockets: socketCount, totalSockets: socketCount } : {}),
    ...(options.uniqueItem ? { uniqueId: options.dwInitSeed, uniqueItemDef: options.uniqueItem } : {}),
    ...(options.setItem ? { setId: options.setItem.id, setItemDef: options.setItem } : {}),
    ...(options.rareAffixes ? { rolledRareAffixes: options.rareAffixes } : {}),
    ...(options.magicAffixes ? { rolledMagicAffixes: options.magicAffixes } : {}),
    ...(effectiveAutoMagic ? { rolledAutoMagic: effectiveAutoMagic } : {}),
    ...(options.staffMods && options.staffMods.length > 0 ? { staffMods: options.staffMods } : {}),
    ...(rolledProps.length > 0 ? { rolledProps } : {}),
  } as Item
}

/**
 * Executes the full TreasureClass drop pipeline for a slain monster or container.
 *
 * @param options - Drop pipeline parameters.
 * @returns Array of dropped Item instances (including gold items).
 */
export function executeDropPipeline(
  tablesOrOptions: DropTables | DropPipelineOptions,
  maybeOptions?: Omit<DropPipelineOptions, 'dropTables'> | D2Rng | Rng | number,
): Item[] {
  const options: DropPipelineOptions =
    'tcTable' in tablesOrOptions
      ? { ...(maybeOptions as Omit<DropPipelineOptions, 'dropTables'>), dropTables: tablesOrOptions }
      : maybeOptions instanceof D2Rng || maybeOptions instanceof Rng || typeof maybeOptions === 'number'
        ? { ...tablesOrOptions, monsterRng: tablesOrOptions.monsterRng ?? tablesOrOptions.seed ?? maybeOptions }
        : tablesOrOptions
  const {
    tcName,
    monsterType = 1,
    difficulty = 'normal',
    playerGf = 0,
    isBoss = false,
    isNoRatio = false,
    partyPlayers = 1,
    isExpansion = true,
  } = options
  const nLevel = options.nLevel ?? options.mlvl ?? 1
  const rawDropTables =
    options.dropTables ??
    (options.registry && 'tcTable' in options.registry
      ? (options.registry as unknown as DropTables)
      : undefined)
  const dropTables = rawDropTables ?? getEmbeddedDropTables()
  const rawMonsterRng = options.monsterRng ?? options.seed
  const playerMf = options.playerMf ?? options.magicFind ?? 0
  const gamePlayers = options.gamePlayers ?? options.playerCount ?? 1
  const maxDrops = options.maxDrops ?? MAX_DROPPED_ITEMS

  if (!tcName || tcName.trim() === '') {
    return []
  }

  if (dropTables.properties && dropTables.itemStatCost) {
    setRuntimePropertyTables(dropTables.properties, dropTables.itemStatCost)
  }

  // A8: Clamp effective ilvl to [1, 99] per 1.13c D2Game!6FC32D60
  const effectiveIlvl = Math.max(1, Math.min(99, Math.trunc(nLevel)))

  // If monsterType === 4 (Act Boss Quest First-Kill) and caller passed the base boss TC
  // (e.g. 'Mephisto (H)' instead of 'Mephistoq (H)'), resolve to the quest TC (TreasureClass4).
  let initialTcName = tcName
  if (monsterType === 4) {
    const bossMatch = /^(Andariel|Duriel|Mephisto|Diablo|Baal)(\s+\([NH]\))?$/.exec(tcName.trim())
    if (bossMatch) {
      const questCandidate = `${bossMatch[1]}q${bossMatch[2] ?? ''}`
      if (dropTables.tcTable.get(questCandidate)) {
        initialTcName = questCandidate
      }
    }
  }

  // 1. Top-level TC group upgrade (D2Game!6FC32D60 / 0x6FC52110)
  // ONLY upgrade if difficulty != 'normal' && isExpansion && !isBoss && !isNoRatio && monsterType !== 4
  const canUpgradeTC =
    difficulty !== 'normal' &&
    isExpansion !== false &&
    !isBoss &&
    !isNoRatio &&
    monsterType !== 4

  const resolvedNode = canUpgradeTC
    ? resolveTreasureClassGroup(dropTables.tcTable, initialTcName, effectiveIlvl)
    : dropTables.tcTable.get(initialTcName)
  const effectiveTcName = resolvedNode?.name ?? initialTcName

  // 2. Setup RNG (D2Game!0x6FC51BB0 uses pMonster->pSeed; never fall back to a fixed constant seed)
  let rng: D2Rng
  if (rawMonsterRng instanceof D2Rng) {
    rng = rawMonsterRng
  } else if (
    rawMonsterRng !== null &&
    typeof rawMonsterRng === 'object' &&
    typeof (rawMonsterRng as D2Rng).rand === 'function'
  ) {
    rng = rawMonsterRng as D2Rng
  } else if (typeof rawMonsterRng === 'number') {
    rng = new D2Rng(rawMonsterRng >>> 0)
  } else {
    throw new Error('executeDropPipeline requires an explicit monsterRng or seed')
  }

  // 3. Expand TC tree (enforcing 6-item cap per D2Game!6FC51BB0)
  const dropLeaves: DroppedItemEntry[] = expandTreasureClass(effectiveTcName, {
    rng,
    tcTable: dropTables.tcTable,
    autoTcTable: dropTables.autoTcTable,
    gamePlayers,
    partyPlayers,
    isExpansion,
    maxDrops,
  })
  if (
    dropLeaves.length === 0 &&
    !dropTables.tcTable.get(effectiveTcName) &&
    !dropTables.autoTcTable.get(effectiveTcName) &&
    dropTables.getBase(effectiveTcName)
  ) {
    dropLeaves.push({
      code: effectiveTcName,
      item: effectiveTcName,
      isGold: false,
      qualityFactors: [0, 0, 0, 0],
      flags: 0,
      forcedUnique: false,
      forcedSet: false,
    })
  }

  // 4. Resolve difficulty odds for base upgrades
  const diffKey = difficulty === 'hell' ? 'Hell' : difficulty === 'nightmare' ? 'Nightmare' : 'Normal'
  const odds = dropTables.difficultyOdds?.get(diffKey) ?? dropTables.difficultyLevels?.get(diffKey)
  if (!odds) {
    throw new Error(`Failed to resolve difficulty odds for difficulty: "${difficulty}"`)
  }
  const isGood = monsterType > 1
  const qf4 = isGood ? odds.uberCodeOddsGood : odds.uberCodeOddsNormal
  const qf5 = isGood ? odds.ultraCodeOddsGood : odds.ultraCodeOddsNormal

  const drops: Item[] = []

  // 5. Process each dropped leaf (capped at maxDrops = 6)
  for (const leaf of dropLeaves) {
    if (drops.length >= maxDrops) {
      break
    }
    if (leaf.isGold) {
      // 1.13c Items.cpp:621: rand(5 * ilvl) + ilvl
      const clampedLvl = effectiveIlvl
      const minGold = clampedLvl
      const maxGoldAdd = 5 * clampedLvl
      const baseGold = Math.max(1, rng.rand(maxGoldAdd) + minGold)

      // Apply TC multiplier (mul flag)
      const multiplier = leaf.goldMultiplier ?? 1
      let goldAmount = Math.max(1, baseGold * multiplier)

      // Apply Player Gold Find multiplier: floor(gold * (100 + GF) / 100)
      if (playerGf !== 0) {
        goldAmount = Math.max(1, Math.floor((goldAmount * (100 + playerGf)) / 100))
      }

      drops.push({ ...goldItem(goldAmount), ilvl: effectiveIlvl, itemLevel: effectiveIlvl })
      continue
    }

    const base = dropTables.getBase(leaf.code)
    if (!base) {
      throw new Error(
        `Drop pipeline failure: unknown item base code "${leaf.code}" in TreasureClass "${effectiveTcName}"`,
      )
    }

    // Base upgrade (D2Game!0x6FC2FB20 enforces candidate.level <= ilvl)
    const upgradeResult = upgradeItemBase(base, qf4, qf5, rng, dropTables.getBase, effectiveIlvl)
    const effectiveBase = upgradeResult.base
    const isUber = upgradeResult.isUber

    // Initialize item PRNG
    const dwInitSeed = (rng.rand(0xFFFFFFFF) >>> 0)
    const itemRng = new D2Rng(dwInitSeed)

    // Resolve ItemTypes.txt quality & class-specific flags
    const typeFlags = resolveItemTypeFlags(effectiveBase, dropTables.itemTypes, dropTables.isA)
    ;(effectiveBase as any).itemClass = typeFlags.itemClass

    // Check if the item can roll magical qualities
    const canHaveQuality =
      !typeFlags.isNormalOnly &&
      (effectiveBase.kind === 'weapon' ||
        effectiveBase.kind === 'armor' ||
        typeFlags.isAlwaysMagic)

    // Roll quality (D2Game!0x6FC2FC40 passes untruncated qlvl = effectiveBase.level)
    const forcedQualityTier: ItemQualityTier | undefined =
      options.forcedQuality === 7 || options.forcedQuality === 'unique'
        ? 'unique'
        : options.forcedQuality === 5 || options.forcedQuality === 'set'
          ? 'set'
          : options.forcedQuality === 6 || options.forcedQuality === 'rare'
            ? 'rare'
            : options.forcedQuality === 4 || options.forcedQuality === 'magic'
              ? 'magic'
              : options.forcedQuality === 3 || options.forcedQuality === 'superior'
                ? 'superior'
                : options.forcedQuality === 2 || options.forcedQuality === 'normal'
                  ? 'normal'
                  : options.forcedQuality === 1 || options.forcedQuality === 'low'
                    ? 'low'
                    : undefined
    let quality: ItemQualityTier
    if (!canHaveQuality) {
      quality = 'normal'
    } else if (leaf.forcedUnique) {
      quality = 'unique'
    } else if (leaf.forcedSet) {
      quality = 'set'
    } else if (forcedQualityTier !== undefined) {
      quality = forcedQualityTier
    } else {
      quality = rollItemQuality({
        ilvl: effectiveIlvl,
        qlvl: effectiveBase.level ?? 1,
        magicFind: playerMf,
        tcFactors: {
          unique: leaf.qualityFactors[0],
          set: leaf.qualityFactors[1],
          rare: leaf.qualityFactors[2],
          magic: leaf.qualityFactors[3],
        },
        table: dropTables.itemRatio,
        rng: itemRng,
        uber: isUber ? 1 : 0,
        classSpecific: typeFlags.isClassSpecific ? 1 : 0,
        allowRare: typeFlags.canBeRare,
        allowSuperior: !typeFlags.isAlwaysMagic,
      })
      if (
        typeFlags.isAlwaysMagic &&
        (quality === 'normal' || quality === 'low' || quality === 'superior')
      ) {
        quality = 'magic'
      }
    }

    let durabilityMultiplier = 1

    // Quality branches & fallbacks (D2 1.13c Ground Truth)
    if (quality === 'unique') {
      const uniqueCandidates = dropTables.uniques.getEnabledByCode(effectiveBase.id).filter(u => u.lvl <= effectiveIlvl)
      if (uniqueCandidates.length > 0) {
        let chosenUnique = uniqueCandidates[0]!
        if (uniqueCandidates.length > 1) {
          const totalRarity = uniqueCandidates.reduce((sum, u) => sum + Math.max(1, u.rarity), 0)
          let roll = itemRng.rand(totalRarity)
          for (const u of uniqueCandidates) {
            const weight = Math.max(1, u.rarity)
            if (roll < weight) {
              chosenUnique = u
              break
            }
            roll -= weight
          }
        }
        const ethAndSock = rollItemEtherealAndSockets(effectiveBase, 'unique', effectiveIlvl, itemRng, {
          uniqueItem: chosenUnique,
          itemTypes: dropTables.itemTypes,
        })
        drops.push(createDroppedItem(effectiveBase, 'unique', {
          uniqueItem: chosenUnique,
          ethereal: ethAndSock.ethereal,
          sockets: ethAndSock.sockets,
          itemTypes: dropTables.itemTypes,
          ilvl: effectiveIlvl,
          dwInitSeed,
          itemRng,
        }))
        continue
      }
      // Unique check failed (no eligible unique exists or ilvl < unique lvl)
      // D2 1.13c Fallback (D2Game!0x6FC30A20 @ 0x6FC30D64..0x6FC30DF5):
      // Unconditionally triple durability (3x) first, then roll Rare if CanBeRare
      // (0x6FC30730) or fall back to Magic (0x6FC304F0) retaining 3x durability.
      durabilityMultiplier = 3
      quality = canItemBeRare(effectiveBase, dropTables.itemTypes, dropTables.isA)
        ? 'rare'
        : 'magic'
    }

    if (quality === 'set') {
      const setCandidates = dropTables.sets.items.entries.filter(
        s => s.item.toLowerCase() === effectiveBase.id.toLowerCase() && s.lvl <= effectiveIlvl,
      )
      if (setCandidates.length > 0) {
        let chosenSet = setCandidates[0]!
        if (setCandidates.length > 1) {
          const totalRarity = setCandidates.reduce((sum, s) => sum + Math.max(1, s.rarity), 0)
          let roll = itemRng.rand(totalRarity)
          for (const s of setCandidates) {
            const weight = Math.max(1, s.rarity)
            if (roll < weight) {
              chosenSet = s
              break
            }
            roll -= weight
          }
        }
        // 1.13c Ground Truth: Set items NEVER spawn Ethereal
        drops.push(createDroppedItem(effectiveBase, 'set', {
          setItem: chosenSet,
          ethereal: false,
          itemTypes: dropTables.itemTypes,
          ilvl: effectiveIlvl,
          dwInitSeed,
          itemRng,
        }))
        continue
      }
      // Set check failed (no eligible set exists or ilvl < set lvl, e.g. Charms)
      // D2 1.13c Fallback: Degrade to Magic + 2x durability (Double Durability)
      quality = 'magic'
      durabilityMultiplier = 2
    }

    if (quality === 'rare') {
      // Check if item can actually be rare (e.g. charms can NEVER be rare)
      if (!canItemBeRare(effectiveBase, dropTables.itemTypes, dropTables.isA)) {
        quality = 'magic'
        durabilityMultiplier = Math.max(durabilityMultiplier, 2)
      } else {
        const rareAffixes = rollRareAffixes(
          effectiveBase,
          effectiveIlvl,
          dropTables.magicAffixes,
          dropTables.rareNames,
          dropTables.isA,
          itemRng,
          { itemClass: typeFlags.itemClass },
        )
        if (rareAffixes && rareAffixes.affixes && rareAffixes.affixes.length > 0) {
          const autoPrefixGroup = resolveAutoPrefixGroup(effectiveBase, dropTables.itemTypes, dropTables.isA)
          const autoMagicAffix =
            autoPrefixGroup !== undefined
              ? rollAutoMagic(
                  effectiveBase,
                  effectiveIlvl,
                  dropTables.autoMagic ?? CANONICAL_AUTOMAGIC_TABLE,
                  dropTables.isA,
                  itemRng,
                  { group: autoPrefixGroup, isRare: true },
                )
              : null
          const staffMods =
            resolveStaffModsClass(effectiveBase, dropTables.itemTypes) !== undefined
              ? rollStaffMods(effectiveBase, effectiveIlvl, dropTables.itemTypes, itemRng)
              : undefined
          const ethAndSock = rollItemEtherealAndSockets(effectiveBase, 'rare', effectiveIlvl, itemRng, {
            itemTypes: dropTables.itemTypes,
          })
          drops.push(createDroppedItem(effectiveBase, 'rare', {
            rareAffixes,
            autoMagicAffix,
            staffMods,
            ethereal: ethAndSock.ethereal,
            sockets: ethAndSock.sockets,
            itemTypes: dropTables.itemTypes,
            ilvl: effectiveIlvl,
            dwInitSeed,
            durabilityMultiplier,
            itemRng,
          }))
          continue
        }
        // Rare affix roll failed: Degrade to Magic + 2x durability
        quality = 'magic'
        durabilityMultiplier = Math.max(durabilityMultiplier, 2)
      }
    }

    if (quality === 'magic') {
      const magicAffixes = rollMagicAffixes(
        effectiveBase,
        effectiveIlvl,
        dropTables.magicAffixes,
        dropTables.isA,
        itemRng,
        { itemClass: typeFlags.itemClass },
      )
      const autoPrefixGroup = resolveAutoPrefixGroup(effectiveBase, dropTables.itemTypes, dropTables.isA)
      const autoMagicAffix =
        autoPrefixGroup !== undefined
          ? rollAutoMagic(
              effectiveBase,
              effectiveIlvl,
              dropTables.autoMagic ?? CANONICAL_AUTOMAGIC_TABLE,
              dropTables.isA,
              itemRng,
              { group: autoPrefixGroup, isRare: false },
            )
          : null
      const staffMods =
        resolveStaffModsClass(effectiveBase, dropTables.itemTypes) !== undefined
          ? rollStaffMods(effectiveBase, effectiveIlvl, dropTables.itemTypes, itemRng)
          : undefined
      const ethAndSock = rollItemEtherealAndSockets(effectiveBase, 'magic', effectiveIlvl, itemRng, {
        itemTypes: dropTables.itemTypes,
      })
      drops.push(createDroppedItem(effectiveBase, 'magic', {
        magicAffixes,
        autoMagicAffix,
        staffMods,
        ethereal: ethAndSock.ethereal,
        sockets: ethAndSock.sockets,
        itemTypes: dropTables.itemTypes,
        ilvl: effectiveIlvl,
        dwInitSeed,
        durabilityMultiplier,
        itemRng,
      }))
      continue
    }

    const autoPrefixGroup = resolveAutoPrefixGroup(effectiveBase, dropTables.itemTypes, dropTables.isA)
    const autoMagicAffix =
      autoPrefixGroup !== undefined
        ? rollAutoMagic(
            effectiveBase,
            effectiveIlvl,
            dropTables.autoMagic ?? CANONICAL_AUTOMAGIC_TABLE,
            dropTables.isA,
            itemRng,
            { group: autoPrefixGroup, isRare: false },
          )
        : null
    const staffMods =
      resolveStaffModsClass(effectiveBase, dropTables.itemTypes) !== undefined
        ? rollStaffMods(effectiveBase, effectiveIlvl, dropTables.itemTypes, itemRng)
        : undefined

    if (quality === 'superior') {
      const ethAndSock = rollItemEtherealAndSockets(effectiveBase, 'superior', effectiveIlvl, itemRng, {
        itemTypes: dropTables.itemTypes,
      })
      drops.push(createDroppedItem(effectiveBase, 'superior', {
        autoMagicAffix,
        staffMods,
        ethereal: ethAndSock.ethereal,
        sockets: ethAndSock.sockets,
        itemTypes: dropTables.itemTypes,
        ilvl: effectiveIlvl,
        dwInitSeed,
        itemRng,
      }))
      continue
    }

    if (quality === 'low') {
      const ethAndSock = rollItemEtherealAndSockets(effectiveBase, 'low', effectiveIlvl, itemRng, {
        itemTypes: dropTables.itemTypes,
      })
      drops.push(createDroppedItem(effectiveBase, 'low', {
        autoMagicAffix,
        staffMods,
        ethereal: ethAndSock.ethereal,
        sockets: ethAndSock.sockets,
        itemTypes: dropTables.itemTypes,
        ilvl: effectiveIlvl,
        dwInitSeed,
        itemRng,
      }))
      continue
    }

    // Default: normal quality
    const ethAndSock = rollItemEtherealAndSockets(effectiveBase, 'normal', effectiveIlvl, itemRng, {
      itemTypes: dropTables.itemTypes,
    })
    drops.push(createDroppedItem(effectiveBase, 'normal', {
      autoMagicAffix,
      staffMods,
      ethereal: ethAndSock.ethereal,
      sockets: ethAndSock.sockets,
      itemTypes: dropTables.itemTypes,
      ilvl: effectiveIlvl,
      dwInitSeed,
      itemRng,
    }))
  }

  return drops
}

/**
 * 1.13c Act 4 Quest 2 (Hell's Forge) rune pools by difficulty.
 * Each difficulty has exactly 11 runes with uniform 1/11 probability:
 * - Normal: El (r01) .. Amn (r11)
 * - Nightmare: Sol (r12) .. Um (r22)
 * - Hell: Hel (r15) .. Gul (r25)
 */
export const HELLFORGE_RUNES_BY_DIFFICULTY: Readonly<Record<Difficulty, readonly string[]>> = {
  normal: ['r01', 'r02', 'r03', 'r04', 'r05', 'r06', 'r07', 'r08', 'r09', 'r10', 'r11'],
  nightmare: ['r12', 'r13', 'r14', 'r15', 'r16', 'r17', 'r18', 'r19', 'r20', 'r21', 'r22'],
  hell: ['r15', 'r16', 'r17', 'r18', 'r19', 'r20', 'r21', 'r22', 'r23', 'r24', 'r25'],
}

/** 1.13c Hellforge normal gem pool (7 types: Amethyst, Topaz, Sapphire, Emerald, Ruby, Diamond, Skull). */
export const HELLFORGE_NORMAL_GEMS: readonly string[] = ['gsv', 'gsy', 'gsb', 'gsg', 'gsr', 'gsw', 'sku']

/** 1.13c Hellforge flawless gem pool (7 types). */
export const HELLFORGE_FLAWLESS_GEMS: readonly string[] = ['gzv', 'gly', 'glb', 'glg', 'glr', 'glw', 'skl']

/** 1.13c Hellforge perfect gem pool (7 types). */
export const HELLFORGE_PERFECT_GEMS: readonly string[] = ['gpv', 'gpy', 'gpb', 'gpg', 'gpr', 'gpw', 'skz']

/** Default area/quest ilvl for Hellforge drops by difficulty. */
const HELLFORGE_ILVL_BY_DIFFICULTY: Readonly<Record<Difficulty, number>> = {
  normal: 27,
  nightmare: 60,
  hell: 85,
}

/**
 * Result of rolling the Act 4 Quest 2 (Hell's Forge) reward drop.
 * Returned as a 5-element Item[] array augmented with structured properties.
 */
export type HellforgeDropResult = Item[] & {
  readonly items: Item[]
  readonly rune: Item
  readonly perfectGem: Item
  readonly flawlessGems: [Item, Item]
  readonly normalGem: Item
  readonly gems: Item[]
}

/**
 * Rolls the 1.13c Act 4 Quest 2 (Hell's Forge) reward drop:
 * - 1 Perfect Gem
 * - 2 Flawless Gems
 * - 1 Normal Gem
 * - 1 Difficulty-specific Rune (1/11 uniform probability)
 *
 * Supports both `(difficulty, rngSource, dropTables, areaLevel?)` and
 * `(difficulty, dropTables, rngSource?, areaLevel?)` argument orders.
 */
export function rollHellforgeDrop(
  difficulty: Difficulty,
  arg2: D2Rng | Rng | number | Pick<DropTables, 'getBase' | 'itemTypes'> | undefined,
  arg3?: Pick<DropTables, 'getBase' | 'itemTypes'> | D2Rng | Rng | number | undefined,
  areaLevel?: number | undefined,
): HellforgeDropResult {
  let rngSource: D2Rng | Rng | number | undefined
  let dropTables: Pick<DropTables, 'getBase' | 'itemTypes'>

  if (arg2 !== null && typeof arg2 === 'object' && 'getBase' in arg2) {
    dropTables = arg2
    rngSource = arg3 as D2Rng | Rng | number | undefined
  } else {
    rngSource = arg2 as D2Rng | Rng | number | undefined
    dropTables = arg3 as Pick<DropTables, 'getBase' | 'itemTypes'>
  }

  let rng: D2Rng
  if (rngSource instanceof D2Rng) {
    rng = rngSource
  } else if (
    rngSource !== null &&
    typeof rngSource === 'object' &&
    typeof (rngSource as D2Rng).rand === 'function'
  ) {
    rng = rngSource as D2Rng
  } else if (typeof rngSource === 'number') {
    rng = new D2Rng(rngSource >>> 0)
  } else {
    throw new Error('rollHellforgeDrop requires an explicit rngSource (D2Rng or numeric seed)')
  }

  const runePool = HELLFORGE_RUNES_BY_DIFFICULTY[difficulty] ?? HELLFORGE_RUNES_BY_DIFFICULTY.normal
  const runeCode = runePool[rng.rand(runePool.length)]!
  const perfectGemCode = HELLFORGE_PERFECT_GEMS[rng.rand(HELLFORGE_PERFECT_GEMS.length)]!
  const flawlessGem1Code = HELLFORGE_FLAWLESS_GEMS[rng.rand(HELLFORGE_FLAWLESS_GEMS.length)]!
  const flawlessGem2Code = HELLFORGE_FLAWLESS_GEMS[rng.rand(HELLFORGE_FLAWLESS_GEMS.length)]!
  const normalGemCode = HELLFORGE_NORMAL_GEMS[rng.rand(HELLFORGE_NORMAL_GEMS.length)]!

  const codes = [runeCode, perfectGemCode, flawlessGem1Code, flawlessGem2Code, normalGemCode]
  const ilvl = areaLevel ?? HELLFORGE_ILVL_BY_DIFFICULTY[difficulty] ?? 27
  const items: Item[] = []

  for (const code of codes) {
    const base = dropTables.getBase(code)
    if (!base) {
      throw new Error(`rollHellforgeDrop: missing item base "${code}" in dropTables`)
    }
    const dwInitSeed = (rng.rand(0xFFFFFFFF) >>> 0)
    const itemRng = new D2Rng(dwInitSeed)
    const dropped = createDroppedItem(base, 'normal', {
      itemTypes: dropTables.itemTypes,
      ilvl,
      dwInitSeed,
      itemRng,
    })
    items.push({
      ...dropped,
      code: code.trim(),
      isGold: false,
    } as Item)
  }

  const result = items as HellforgeDropResult
  Object.assign(result, {
    items,
    rune: items[0]!,
    perfectGem: items[1]!,
    flawlessGems: [items[2]!, items[3]!] as [Item, Item],
    normalGem: items[4]!,
    gems: [items[1]!, items[2]!, items[3]!, items[4]!],
  })
  return result
}

const CHARSI_NON_IMBUEABLE_QUEST_CODES: ReadonlySet<string> = new Set([
  'bks', 'bkd', 'hdm', 'ass', 'tr1', 'box', 'hst', 'msf', 'vip', 'j34', 'g34',
  'xyz', 'g33', 'd33', 'bbb', 'qey', 'qhr', 'qbr', 'qf1', 'qf2', 'mss', 'hfh',
  'ice', 'tr2',
])

const CHARSI_THROWING_TYPE_CODES: ReadonlySet<string> = new Set([
  'thro', 'tkni', 'taxe', 'jav', 'ajav',
])

/**
 * 1.13c Charsi Imbue target ilvl calculation (`D2Game.dll` `QUESTS_Act1Q5_ImbueItem` @ `0x6fce040e..0x6fce041e`):
 * - If `playerLevel > 5`: `ilvl = Math.min(99, playerLevel + 4)`
 * - Otherwise (`playerLevel <= 5`): `ilvl = Math.max(1, playerLevel)`
 */
export function computeCharsiImbueIlvl(playerLevel: number): number {
  const clvl = Math.max(1, Math.trunc(Number.isFinite(playerLevel) ? playerLevel : 1))
  const rawIlvl = clvl > 5 ? clvl + 4 : clvl
  return Math.max(1, Math.min(99, rawIlvl))
}

/**
 * 1.13c Charsi Imbue item eligibility check (`D2Common.dll` `D2Common_10185` / `ITEMS_CheckIfImbueable` @ `0x6fd750b0`):
 * - Must be a weapon or armor base (`Weapons.txt` or `Armor.txt`, never `Misc.txt`, never quivers `aqv`/`cqv` or `ear`).
 * - Base item type must support Rare quality (`Rare != 0`, not normal-only, not non-imbueable quest items; Wirt's Leg `'leg'` IS allowed).
 * - Item must be identified (`ITEMFLAG_IDENTIFIED`).
 * - Quality must be Low Quality (`1`), Normal (`2`), or Superior (`3`).
 * - Item must have `0` sockets (`sockets === 0` and not `ITEMFLAG_SOCKETED`).
 * - Item must NOT be both Ethereal (`ITEMFLAG_ETHEREAL`) and a Throwing Weapon (`ITEMTYPE_THROWING_WEAPON`);
 *   non-throwing ethereal weapons and ethereal armor ARE eligible.
 */
export function isEligibleForCharsiImbue113c(
  itemOrCode: string | Record<string, any> | null | undefined,
  dropTables?: DropTables,
): boolean {
  if (!itemOrCode) return false
  const tables = dropTables ?? getEmbeddedDropTables()

  let code = ''
  if (typeof itemOrCode === 'string') {
    code = itemOrCode.trim()
  } else if (typeof itemOrCode === 'object') {
    // 1. Identified check (0x6fd750de)
    if (itemOrCode.identified === false || itemOrCode.flags?.identified === false) {
      return false
    }
    if (
      typeof itemOrCode.rawFlags === 'number' &&
      (itemOrCode.rawFlags & (0x10 | ItemFlag.IDENTIFIED)) === 0 &&
      itemOrCode.identified !== true
    ) {
      return false
    }

    // 2. Quality 1..3 check (low / normal / superior; 0x6fd750ea)
    const rawQual = itemOrCode.quality ?? itemOrCode.rarity
    if (typeof rawQual === 'number') {
      if (rawQual < 1 || rawQual > 3) return false
    } else if (typeof rawQual === 'string') {
      const qLower = rawQual.trim().toLowerCase()
      if (qLower !== 'low' && qLower !== 'normal' && qLower !== 'superior') {
        return false
      }
    }

    // 3. Socket check (0x6fd750f6..0x6fd75106)
    const sockets = Number(itemOrCode.sockets ?? itemOrCode.totalSockets ?? 0)
    if (sockets > 0) return false
    if (itemOrCode.socketed === true || itemOrCode.flags?.socketed === true) return false
    if (
      typeof itemOrCode.rawFlags === 'number' &&
      (itemOrCode.rawFlags & 0x800) !== 0
    ) {
      return false
    }
    if (Array.isArray(itemOrCode.socketedItems) && itemOrCode.socketedItems.length > 0) {
      return false
    }

    const rawCode =
      itemOrCode.code ??
      itemOrCode.itemCode ??
      (itemOrCode.base && typeof itemOrCode.base.id === 'number'
        ? formatItemCode(itemOrCode.base.id)
        : itemOrCode.base?.code)
    code = typeof rawCode === 'string' ? rawCode.trim() : ''
  }

  if (!code) return false
  if (code === 'aqv' || code === 'cqv' || code === 'ear') return false
  if (CHARSI_NON_IMBUEABLE_QUEST_CODES.has(code)) return false

  const weaponRow = tables.weapons.byCode.get(code)
  const armorRow = tables.armor.byCode.get(code)
  const miscRow = tables.misc.byCode.get(code)
  if (miscRow || (!weaponRow && !armorRow)) return false

  // Wirt's Leg ('leg') has quest > 0 in Weapons.txt but Rare = 1 in ItemTypes.txt ('club') and is imbueable in 1.13c.
  if (code !== 'leg') {
    const questVal = Number((weaponRow as any)?.quest ?? (armorRow as any)?.quest ?? 0)
    if (questVal > 0) return false
  }

  const base = tables.getBase(code)
  if (!base) return false
  const flags = resolveItemTypeFlags(base, tables.itemTypes, tables.isA)
  if (!flags.canBeRare || flags.isNormalOnly) return false

  if (typeof itemOrCode === 'object') {
    const isEthereal = Boolean(
      itemOrCode.ethereal ||
      itemOrCode.isEthereal ||
      itemOrCode.flags?.ethereal ||
      (typeof itemOrCode.rawFlags === 'number' && (itemOrCode.rawFlags & (0x400000 | ItemFlag.ETHEREAL)) !== 0),
    )
    if (isEthereal) {
      const wType = weaponRow?.type?.trim().toLowerCase() ?? ''
      const isThrowing = Boolean(
        itemOrCode.isThrowing === true ||
        (wType && (CHARSI_THROWING_TYPE_CODES.has(wType) || tables.isA(wType, 'thro'))),
      )
      if (isThrowing) return false
    }
  }

  return true
}

export interface CharsiImbueOptions {
  readonly playerLevel?: number | undefined
  readonly rng?: D2Rng | number | undefined
  readonly seed?: number | undefined
  readonly dropTables?: DropTables | undefined
  readonly ethereal?: boolean | undefined
  readonly personalized?: boolean | undefined
  readonly personalizedName?: string | undefined
}

/**
 * Executes the 1.13c Charsi Imbue item transformation (`D2Game.dll` `QUESTS_Act1Q5_ImbueItem` @ `0x6fce0310`):
 * - Validates item eligibility via `isEligibleForCharsiImbue113c` (`D2Common_10185`).
 * - Computes `ilvl = computeCharsiImbueIlvl(playerLevel)`.
 * - Rolls Rare prefix/suffix name (`RarePrefix.txt` / `RareSuffix.txt`) and `3..6` affixes (`rollRareAffixes`),
 *   plus optional `autoMagicAffix` and `staffMods`.
 * - Preserves `ethereal` state from the source item (`0x6fce0391`: never rolls random ethereal on non-ethereal items;
 *   always keeps ethereal if the source item was ethereal) and `personalized` / `personalizedName` (`0x6fce03b1..0x6fce0489`).
 * - Marks the resulting Rare item as identified (`identified = true`, `ITEMFLAG_IDENTIFIED` @ `0x6fce0467`).
 */
export function imbueItem113c(
  itemOrCode: string | Record<string, any>,
  playerLevelOrOptions?: number | CharsiImbueOptions,
  optionsArg?: CharsiImbueOptions,
): Omit<Item, 'quality' | 'prefixes' | 'suffixes'> & {
  readonly quality: 'rare'
  readonly ilvl: number
  readonly identified: true
  readonly ethereal?: boolean | undefined
  readonly sockets: number
  readonly rareName1: number
  readonly rareName2: number
  readonly rarePrefixId: number
  readonly rareSuffixId: number
  readonly rareName: string
  readonly prefixes: GeneratedRareAffixes['prefixes']
  readonly suffixes: GeneratedRareAffixes['suffixes']
  readonly rareAffixes: readonly ItemAffixSlot[]
  readonly rareAffixIds: readonly number[]
  readonly rolledProps: readonly RolledItemProp[]
  readonly autoAffixId?: number | undefined
  readonly personalized?: boolean | undefined
  readonly personalizedName?: string | undefined
} {
  const options: CharsiImbueOptions | undefined =
    typeof playerLevelOrOptions === 'object' ? playerLevelOrOptions : optionsArg
  const playerLevel =
    typeof playerLevelOrOptions === 'number'
      ? playerLevelOrOptions
      : (options?.playerLevel ?? 8)
  const dropTables = options?.dropTables ?? getEmbeddedDropTables()
  if (!isEligibleForCharsiImbue113c(itemOrCode, dropTables)) {
    const desc = typeof itemOrCode === 'string' ? itemOrCode : (itemOrCode?.code ?? itemOrCode?.name ?? 'unknown')
    throw new Error(`imbueItem113c: item "${String(desc)}" is not eligible for Charsi Imbue (D2Common_10185)`)
  }

  const code =
    typeof itemOrCode === 'string'
      ? itemOrCode.trim()
      : String(
          itemOrCode.code ??
            itemOrCode.itemCode ??
            (itemOrCode.base && typeof itemOrCode.base.id === 'number'
              ? formatItemCode(itemOrCode.base.id)
              : itemOrCode.base?.code ?? ''),
        ).trim()

  const base = dropTables.getBase(code)
  if (!base) {
    throw new Error(`imbueItem113c: unknown item base code "${code}"`)
  }

  const ilvl = computeCharsiImbueIlvl(playerLevel)
  const seedInput = options?.seed ?? (typeof options?.rng === 'number' ? options.rng : undefined)
  let itemRng: D2Rng
  if (options?.rng instanceof D2Rng) {
    itemRng = options.rng
  } else if (typeof seedInput === 'number') {
    itemRng = new D2Rng(seedInput >>> 0)
  } else if (typeof itemOrCode === 'object' && typeof itemOrCode.uniqueId === 'number' && itemOrCode.uniqueId > 0) {
    itemRng = new D2Rng((itemOrCode.uniqueId ^ 0x6fce0310) >>> 0)
  } else {
    itemRng = new D2Rng(0x6fce0310)
  }
  const dwInitSeed = (itemRng.rand(0xFFFFFFFF) >>> 0) || 0x13579bdf

  const typeFlags = resolveItemTypeFlags(base, dropTables.itemTypes, dropTables.isA)
  const rareAffixes = rollRareAffixes(
    base,
    ilvl,
    dropTables.magicAffixes,
    dropTables.rareNames,
    dropTables.isA,
    itemRng,
    { itemClass: typeFlags.itemClass },
  )

  const autoPrefixGroup = resolveAutoPrefixGroup(base, dropTables.itemTypes, dropTables.isA)
  const autoMagicAffix =
    autoPrefixGroup !== undefined
      ? rollAutoMagic(
          base,
          ilvl,
          dropTables.autoMagic ?? CANONICAL_AUTOMAGIC_TABLE,
          dropTables.isA,
          itemRng,
          { group: autoPrefixGroup, isRare: true },
        )
      : null
  const staffMods =
    resolveStaffModsClass(base, dropTables.itemTypes) !== undefined
      ? rollStaffMods(base, ilvl, dropTables.itemTypes, itemRng)
      : undefined

  const wasEthereal = Boolean(
    options?.ethereal ??
      (typeof itemOrCode === 'object' &&
        (itemOrCode.ethereal ||
          itemOrCode.isEthereal ||
          itemOrCode.flags?.ethereal ||
          (typeof itemOrCode.rawFlags === 'number' && (itemOrCode.rawFlags & (0x400000 | ItemFlag.ETHEREAL)) !== 0))),
  )
  const wasPersonalized = Boolean(
    options?.personalized ??
      (typeof itemOrCode === 'object' &&
        (itemOrCode.personalized ||
          itemOrCode.isPersonalized ||
          itemOrCode.flags?.personalized ||
          (typeof itemOrCode.rawFlags === 'number' && (itemOrCode.rawFlags & (0x01000000 | ItemFlag.PERSONALIZED)) !== 0))),
  )
  const personalizedName =
    options?.personalizedName ??
    (typeof itemOrCode === 'object' && typeof itemOrCode.personalizedName === 'string'
      ? itemOrCode.personalizedName
      : undefined)

  const dropped = createDroppedItem(base, 'rare', {
    rareAffixes,
    autoMagicAffix,
    staffMods,
    ethereal: wasEthereal,
    sockets: 0,
    itemTypes: dropTables.itemTypes,
    ilvl,
    dwInitSeed,
    itemRng,
    identified: true,
  })

  const rawFlags = (dropped.rawFlags ?? 0) | (wasPersonalized ? ItemFlag.PERSONALIZED : 0)
  const flags = decodeItemFlags(rawFlags)
  const rareName1 = rareAffixes.rarePrefix !== undefined ? rareAffixes.rarePrefix.index + 1 : 1
  const rareName2 = rareAffixes.rareSuffix !== undefined ? rareAffixes.rareSuffix.index + 1 : 1
  const rareAffixIds = [
    rareAffixes.prefixes[0]?.affix.id ?? 0,
    rareAffixes.suffixes[0]?.affix.id ?? 0,
    rareAffixes.prefixes[1]?.affix.id ?? 0,
    rareAffixes.suffixes[1]?.affix.id ?? 0,
    rareAffixes.prefixes[2]?.affix.id ?? 0,
    rareAffixes.suffixes[2]?.affix.id ?? 0,
  ]
  const rareAffixSlots: ItemAffixSlot[] = rareAffixIds.map((id) =>
    id > 0 ? { present: true, id } : { present: false },
  )
  const autoAffixId = autoMagicAffix?.entry?.id
  const totalSockets = dropped.totalSockets ?? (dropped as any).sockets ?? 0

  return {
    ...dropped,
    ...(typeof itemOrCode === 'object' && itemOrCode.id !== undefined ? { id: itemOrCode.id } : {}),
    code: (dropped.code ?? code).trim(),
    quality: 'rare' as unknown as ItemQuality,
    rarity: 'rare',
    ilvl,
    rawFlags,
    flags,
    identified: true,
    ethereal: wasEthereal,
    sockets: totalSockets,
    totalSockets,
    rareName1,
    rareName2,
    rarePrefixId: rareName1,
    rareSuffixId: rareName2,
    rareName: rareAffixes.name,
    prefixes: rareAffixes.prefixes,
    suffixes: rareAffixes.suffixes,
    rareAffixes: rareAffixSlots,
    rareAffixIds,
    rolledProps: dropped.rolledProps ?? [],
    ...(autoAffixId !== undefined ? { autoAffixId } : {}),
    ...(wasPersonalized ? { personalized: true } : {}),
    ...(personalizedName ? { personalizedName } : {}),
  } as any
}
