/**
 * Diablo II Exceptional / Elite Item Base Upgrade System.
 *
 * Implements base item quality upgrades during TreasureClass drop generation:
 * - Reads difficulty parameters from `Difficultylevels.txt` (UberCodeOddsNormal, UberCodeOddsGood,
 *   UltraCodeOddsNormal, UltraCodeOddsGood for Normal, Nightmare, Hell).
 * - Implements 1.13c disassembly logic from D2Game!6FC32380 and D2Game!6FC31880:
 *   - qf[4] (uberCodeOdds) and qf[5] (ultraCodeOdds) checks against rng.rand(1024).
 *   - Flags 0x04 (exceptional) and 0x10 (elite).
 *   - Selection priority: elite ultracode -> exceptional ubercode -> original base (normcode).
 *   - When upgraded, the item base is replaced with the upgraded base, and `isUber` is set to true.
 */
import type { D2Table } from '../world/acts.ts'
import { parseTable } from '../world/acts.ts'
import type { MountedArchives } from '../mpq/mount.ts'
import type { ItemBase } from './items.ts'
import type { D2Rng } from '../rng/d2-rng.ts'
import { isQuestItemBase113c } from './runeword.ts'

/** Canonical MPQ path of `Difficultylevels.txt`. */
export const DIFFICULTY_LEVELS_TABLE_PATH = 'data\\global\\excel\\Difficultylevels.txt'

/** Bitflag set when exceptional upgrade succeeds (genFlags |= 0x04). */
export const ITEM_UPGRADE_FLAG_EXCEPTIONAL = 0x04

/** Bitflag set when elite upgrade succeeds (genFlags |= 0x10). */
export const ITEM_UPGRADE_FLAG_ELITE = 0x10

/**
 * Difficulty level odds parsed from `Difficultylevels.txt`.
 */
export interface DifficultyLevelOdds {
  readonly name: string
  readonly uberCodeOddsNormal: number
  readonly uberCodeOddsGood: number
  readonly ultraCodeOddsNormal: number
  readonly ultraCodeOddsGood: number
  // PascalCase aliases matching exact table column names
  readonly UberCodeOddsNormal: number
  readonly UberCodeOddsGood: number
  readonly UltraCodeOddsNormal: number
  readonly UltraCodeOddsGood: number
}

import { CaseInsensitiveMap } from './tables.ts'

/**
 * Parsed collection of difficulty level upgrade odds from `Difficultylevels.txt`.
 */
export type DifficultyLevelTable = DifficultyLevelsTable

export class DifficultyLevelsTable {
  readonly all: readonly DifficultyLevelOdds[]
  readonly byName: Map<string, DifficultyLevelOdds>
  readonly normal: DifficultyLevelOdds
  readonly nightmare: DifficultyLevelOdds
  readonly hell: DifficultyLevelOdds
  readonly Normal: DifficultyLevelOdds
  readonly Nightmare: DifficultyLevelOdds
  readonly Hell: DifficultyLevelOdds

  constructor(all: DifficultyLevelOdds[], byName: Map<string, DifficultyLevelOdds>) {
    this.all = all
    this.byName = byName

    const normal = byName.get('Normal') ?? all[0]
    const nightmare = byName.get('Nightmare') ?? all[1]
    const hell = byName.get('Hell') ?? all[2]

    if (!normal || !nightmare || !hell) {
      throw new Error(
        `Failed to initialize DifficultyLevelsTable: expected Normal, Nightmare, and Hell entries, received ${all.length} total entries`
      )
    }

    this.normal = normal
    this.nightmare = nightmare
    this.hell = hell
    this.Normal = normal
    this.Nightmare = nightmare
    this.Hell = hell
  }

  get(name: string): DifficultyLevelOdds | undefined {
    return this.byName.get(name)
  }

  [Symbol.iterator](): IterableIterator<DifficultyLevelOdds> {
    return this.all[Symbol.iterator]()
  }

  get length(): number {
    return this.all.length
  }
}

/**
 * Parses `Difficultylevels.txt` table rows into {@link DifficultyLevelsTable}.
 *
 * @param table - Raw parsed tab-separated D2Table.
 * @returns {@link DifficultyLevelsTable} instance.
 */
export function parseDifficultyLevelsTable(table: D2Table): DifficultyLevelsTable {
  const colMap = new Map<string, number>()
  const lowerMap = new Map<string, number>()

  table.header.forEach((name, idx) => {
    const trimmed = name.trim()
    if (!colMap.has(trimmed)) {
      colMap.set(trimmed, idx)
    }
    const lower = trimmed.toLowerCase()
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

  const all: DifficultyLevelOdds[] = []
  const byName = new CaseInsensitiveMap<DifficultyLevelOdds>()

  for (const row of table.rows) {
    const name = strAt(row, 'Name')
    if (!name || name === 'Expansion') {
      continue
    }

    const uberCodeOddsNormal = numAt(row, 'UberCodeOddsNormal', 0)
    const uberCodeOddsGood = numAt(row, 'UberCodeOddsGood', 0)
    const ultraCodeOddsNormal = numAt(row, 'UltraCodeOddsNormal', 0)
    const ultraCodeOddsGood = numAt(row, 'UltraCodeOddsGood', 0)

    const entry: DifficultyLevelOdds = {
      name,
      uberCodeOddsNormal,
      uberCodeOddsGood,
      ultraCodeOddsNormal,
      ultraCodeOddsGood,
      UberCodeOddsNormal: uberCodeOddsNormal,
      UberCodeOddsGood: uberCodeOddsGood,
      UltraCodeOddsNormal: ultraCodeOddsNormal,
      UltraCodeOddsGood: ultraCodeOddsGood,
    }

    all.push(entry)
    byName.set(name, entry)
  }

  return new DifficultyLevelsTable(all, byName)
}

/**
 * Loads and parses `Difficultylevels.txt` from mounted MPQ archives.
 *
 * @param archives - Mounted MPQ archives.
 * @param path - Optional override MPQ path (defaults to {@link DIFFICULTY_LEVELS_TABLE_PATH}).
 * @returns Promise resolving to {@link DifficultyLevelsTable}.
 */
export async function loadDifficultyLevels(
  archives: MountedArchives,
  path = DIFFICULTY_LEVELS_TABLE_PATH,
): Promise<DifficultyLevelsTable> {
  const bytes = await archives.read(path)
  const d2Table = parseTable(bytes)
  return parseDifficultyLevelsTable(d2Table)
}

/**
 * ItemBase with optional tier code linkages (normcode, ubercode, ultracode).
 */
export interface UpgradableItemBase extends ItemBase {
  readonly normcode?: string | undefined
  readonly ubercode?: string | undefined
  readonly ultracode?: string | undefined
  readonly code?: string | undefined
}

/**
 * Result of rolling an item base upgrade.
 */
export interface BaseUpgradeResult {
  /** The resulting item base (original or exceptional/elite). */
  readonly base: ItemBase
  /** Whether the base was upgraded to exceptional or elite tier. */
  readonly isUber: boolean
}

/**
 * Checks whether a base code is valid for upgrade (non-empty and not 'xxx').
 */
function isValidUpgradeCode(code: unknown): code is string {
  if (typeof code !== 'string') {
    return false
  }
  const trimmed = code.trim()
  return trimmed.length > 0 && trimmed.toLowerCase() !== 'xxx'
}

/**
 * Determines whether an item base is an Exceptional or Elite ("Uber") weapon/armor
 * for `ItemRatio.txt` row selection per 1.13c `D2Common.dll` `0x6FD74D00` (exported at `#10772`
 * `0x6FD75BD0`, called by `D2Common #10560` `DATATBLS_GetItemRatioTxtRecord` at `0x6FDC402D`):
 *
 * 1. `0x6FD74D06..0x6FD74D1D`: `ITEMS_CheckItemTypeId(dwClassId, 0x32 ['armo']) ||
 *    ITEMS_CheckItemTypeId(dwClassId, 0x2d ['weap'])` — must be an armor or weapon item type.
 * 2. `0x6FD74D2B..0x6FD74D3F`: `pItemsTxt->dwCode == pItemsTxt->dwUberCode ||
 *    pItemsTxt->dwCode == pItemsTxt->dwUltraCode` — the item's own code equals its `ubercode`
 *    or `ultracode` column in `Weapons.txt` / `Armor.txt` (regardless of whether the base was
 *    upgraded during the current drop roll or selected directly from an auto-TC like `armo60`).
 * 3. `0x6FD74D41..0x6FD74D4A`: `ITEMS_GetItemType(dwClassId) != 0x26 ('tpot')` — throwing potions
 *    (`gps`, `ops`, `gpm`, `opm`, `gpl`, `opl`, which have `normcode = ubercode = ultracode = code`)
 *    are excluded.
 * 4. `0x6FD74D4C..0x6FD74D54`: `pItemsTxt->nQuest == 0` (`BYTE PTR [edi+0x12a] == 0`) — quest items
 *    (such as `qf2` Khalim's Will where `ubercode = ultracode = 'qf2'` and `quest = 23`) are excluded.
 */
export function isItemUber113c(
  base: ItemBase,
  isAPredicate?: ((type: string, target: string) => boolean) | undefined,
): boolean {
  const rawType = (base as { type?: string }).type
  const typeCode =
    typeof rawType === 'string' && rawType.trim().length > 0
      ? rawType.trim().toLowerCase()
      : Array.isArray(base.tags) && typeof base.tags[0] === 'string'
        ? base.tags[0].trim().toLowerCase()
        : ''

  const isWeaponOrArmor =
    isAPredicate && typeCode.length > 0
      ? isAPredicate(typeCode, 'armo') || isAPredicate(typeCode, 'weap')
      : base.kind === 'armor' || base.kind === 'weapon'
  if (!isWeaponOrArmor) {
    return false
  }

  const uBase = base as Partial<UpgradableItemBase>
  const code = (uBase.code ?? base.id ?? '').trim().toLowerCase()
  const ubercode = typeof uBase.ubercode === 'string' ? uBase.ubercode.trim().toLowerCase() : ''
  const ultracode = typeof uBase.ultracode === 'string' ? uBase.ultracode.trim().toLowerCase() : ''
  if (!code || code === 'xxx' || (code !== ubercode && code !== ultracode)) {
    return false
  }

  if (typeCode === 'tpot') {
    return false
  }

  const quest = Number((base as { quest?: number }).quest) || 0
  if (quest !== 0) {
    return false
  }

  return true
}

/**
 * Rolls exceptional / elite base upgrade for an item base.
 *
 * Disassembly reference:
 * - D2Game!6FC32380 (drop roll loop):
 *   `if (qf[4] && (rng.rand(1024) < qf[4])) genFlags |= 0x04`
 *   `if (qf[5] && (rng.rand(1024) < qf[5])) genFlags |= 0x10`
 * - D2Game!6FC31880 (base upgrade dispatch):
 *   - If genFlags & 0x10 (elite): check base `ultracode`. If valid and !== 'xxx', use ultracode.
 *   - Else if genFlags & 0x04 (exceptional): check base `ubercode`. If valid and !== 'xxx', use ubercode.
 *   - Otherwise keep original `normcode`.
 * - When upgraded:
 *   - Replaces item base with the exceptional/elite base (providing the new base's `qlvl` / `level`).
 *   - `isUber` flag is set to true.
 *
 * @param base - Original item base (usually normal tier).
 * @param qf4 - Uber code odds (qf[4], e.g. UberCodeOddsNormal or UberCodeOddsGood).
 * @param qf5 - Ultra code odds (qf[5], e.g. UltraCodeOddsNormal or UltraCodeOddsGood).
 * @param rng - Diablo II PRNG instance.
 * @param lookupBase - Lookup function resolving a 3-4 letter item code to an {@link ItemBase}.
 * @param ilvl - Optional item level (`nLevel`); when provided, upgraded bases whose `qlvl > ilvl` are rejected (`D2Game!0x6FCF2BD1`).
 * @returns {@link BaseUpgradeResult} containing the new or original base and `isUber`.
 */
export interface RollBaseUpgradeOptions {
  /** Whether ladder-only rules are active (defaults to `false`, `#1949`). */
  readonly isLadder?: boolean | undefined
  /** When `true`, gates Exceptional -> Elite (`ITEM_UPGRADE_FLAG_ELITE`) on `isLadder === true` (`Cubemain.txt` Rows 131..132). */
  readonly gateEliteOnLadder?: boolean | undefined
}

export function rollBaseUpgrade(
  base: ItemBase,
  qf4: number,
  qf5: number,
  rng: D2Rng,
  lookupBase: (code: string) => ItemBase | undefined,
  ilvl?: number | undefined,
  options?: RollBaseUpgradeOptions | undefined,
): BaseUpgradeResult {
  // Quest items (`nQuest != 0`, e.g. 'leg', 'hfh', 'msf', 'hst', 'qf1', 'qf2') never upgrade (#1949).
  if (isQuestItemBase113c(base)) {
    return { base, isUber: false }
  }

  const isLadder = options?.isLadder ?? false
  const allowElite = options?.gateEliteOnLadder ? isLadder : true
  let genFlags = 0

  if (qf4 > 0 && rng.rand(1024) < qf4) {
    genFlags |= ITEM_UPGRADE_FLAG_EXCEPTIONAL
  }

  if (allowElite && qf5 > 0 && rng.rand(1024) < qf5) {
    genFlags |= ITEM_UPGRADE_FLAG_ELITE
  }

  const uBase = base as Partial<UpgradableItemBase>
  const rawUltra = uBase.ultracode
  const rawUber = uBase.ubercode

  const ultracode = isValidUpgradeCode(rawUltra) ? rawUltra.trim() : undefined
  const ubercode = isValidUpgradeCode(rawUber) ? rawUber.trim() : undefined

  const canUseUpgraded = (candidate: ItemBase | undefined): candidate is ItemBase => {
    if (!candidate) return false
    if (ilvl !== undefined && (candidate.level ?? 1) > ilvl) return false
    return true
  }

  let targetCode: string | undefined
  if ((genFlags & ITEM_UPGRADE_FLAG_ELITE) && ultracode) {
    targetCode = ultracode
  } else if ((genFlags & ITEM_UPGRADE_FLAG_EXCEPTIONAL) && ubercode) {
    targetCode = ubercode
  }

  if (targetCode) {
    const upgraded = lookupBase(targetCode) ?? lookupBase(targetCode.toLowerCase())
    if (canUseUpgraded(upgraded)) {
      const uTarget = upgraded as Partial<UpgradableItemBase>
      const effectiveTarget: ItemBase =
        uTarget.ubercode !== undefined || uTarget.ultracode !== undefined
          ? upgraded
          : ({ ...upgraded, ubercode, ultracode } as ItemBase)
      return { base: upgraded, isUber: isItemUber113c(effectiveTarget) }
    }
    // If elite was selected but lookup failed or qlvl > ilvl, fall back to exceptional if rolled and valid
    if (
      (genFlags & ITEM_UPGRADE_FLAG_ELITE) &&
      (genFlags & ITEM_UPGRADE_FLAG_EXCEPTIONAL) &&
      ubercode &&
      targetCode !== ubercode
    ) {
      const fallbackUber = lookupBase(ubercode) ?? lookupBase(ubercode.toLowerCase())
      if (canUseUpgraded(fallbackUber)) {
        const uFallback = fallbackUber as Partial<UpgradableItemBase>
        const effectiveFallback: ItemBase =
          uFallback.ubercode !== undefined || uFallback.ultracode !== undefined
            ? fallbackUber
            : ({ ...fallbackUber, ubercode, ultracode } as ItemBase)
        return { base: fallbackUber, isUber: isItemUber113c(effectiveFallback) }
      }
    }
  }

  return { base, isUber: isItemUber113c(base) }
}

/** Alias for rollBaseUpgrade conforming to spec nomenclature. */
export const upgradeItemBase = rollBaseUpgrade

