/**
 * Pure view model for `stats.html`:
 * - Scope filtering (`all` | `account` | `character`)
 * - Sidebar account -> character hierarchy with localized class names and badges
 * - Solo-only filter (`count` vs `soloCount`)
 * - Difficulty summary cards (`normal`, `nightmare`, `hell`, `total` from `kind === 'monster'` only)
 * - 86-row Boss & SuperUnique Kill Board (`24` killable `MonStats` `boss=1` rows + `66` `SuperUniques.txt`
 *   rows minus `4` overlapping rows `229:radament`->`SU10`, `250:summoner`->`SU18`,
 *   `365:griswold`->`SU5`, `526:nihlathakboss`->`SU60`, with duplicate-name canonical ID subtitles)
 * - Monster Type × Difficulty table with column sorting and bilingual name/ID search
 */

import type { GameLang } from '../../src/client/plugin-host/api.ts'
import { resolveTblKey } from '../../src/common/data/canonical-tbl-strings.ts'
import {
  getMonsterKindByClassId,
  getSuperUniqueByIndex,
} from '../../src/common/units/monsters-data.ts'
import { CHAR_CLASS_NAMES, type CharClassId } from '../../src/netproto/index.ts'
import {
  MONSTATS_MAX_HCIDX,
  isCountableBossClass,
  isCountableKillClass,
} from './monster-kill-classes.ts'
import {
  SUPERUNIQUE_COUNT,
  type KillCharacterRecord,
  type KillStatsSnapshot,
  type KillTallyRecord,
} from './kill-stats-model.ts'

export const BOSS_SU_BOARD_ROW_COUNT = 86 as const

export type KillStatsScope =
  | { readonly kind: 'all' }
  | {
      readonly kind: 'account'
      readonly host: string
      readonly realm: string
      readonly account: string
    }
  | {
      readonly kind: 'character'
      readonly charKey: string
    }

export type MonsterSortColumn =
  | 'hcIdx'
  | 'id'
  | 'name'
  | 'normal'
  | 'nightmare'
  | 'hell'
  | 'total'

export type SortDirection = 'asc' | 'desc'

export interface MonsterTableSort {
  readonly column: MonsterSortColumn
  readonly direction: SortDirection
}

export interface KillStatsViewOptions {
  readonly scope?: KillStatsScope | undefined
  readonly soloOnly?: boolean | undefined
  readonly showUnkilled?: boolean | undefined
  readonly lang?: GameLang | undefined
  readonly monsterSearch?: string | undefined
  readonly monsterSort?: MonsterTableSort | undefined
}

export interface KillStatsCharacterNode {
  readonly charKey: string
  readonly host: string
  readonly realm: string
  readonly account: string
  readonly charName: string
  readonly charClass: CharClassId
  readonly className: string
  readonly level: number
  readonly hardcore: boolean
  readonly expansion: boolean
  readonly ladder: boolean
  readonly totalKills: number
  readonly lastSeenAt: number
}

export interface KillStatsAccountNode {
  readonly accountKey: string
  readonly host: string
  readonly realm: string
  readonly account: string
  readonly label: string
  readonly totalKills: number
  readonly characters: readonly KillStatsCharacterNode[]
}

export interface KillStatsSummaryCards {
  readonly normal: number
  readonly nightmare: number
  readonly hell: number
  readonly total: number
}

export interface KillStatsBoardCatalogEntry {
  readonly key: string
  readonly rowKind: 'boss' | 'superunique'
  readonly subject: number
  readonly canonicalId: string
  readonly baseMonsterId: string
  readonly baseHcIdx: number
  readonly mergedBossHcIdx: number | null
  readonly nameKey: string
}

export interface KillStatsBoardRow extends KillStatsBoardCatalogEntry {
  readonly name: string
  readonly nameZh: string
  readonly nameEn: string
  readonly subtitle: string | null
  readonly normal: number
  readonly nightmare: number
  readonly hell: number
  readonly total: number
  readonly lastAt: number | null
}

export interface KillStatsMonsterRow {
  readonly hcIdx: number
  readonly id: string
  readonly nameKey: string
  readonly name: string
  readonly nameZh: string
  readonly nameEn: string
  readonly normal: number
  readonly nightmare: number
  readonly hell: number
  readonly total: number
  readonly lastAt: number | null
}

export interface KillStatsViewModel {
  readonly scope: KillStatsScope
  readonly soloOnly: boolean
  readonly showUnkilled: boolean
  readonly lang: GameLang
  readonly monsterSearch: string
  readonly monsterSort: MonsterTableSort
  readonly totalAllAccountsKills: number
  readonly accounts: readonly KillStatsAccountNode[]
  readonly selectedCharacter: KillStatsCharacterNode | null
  readonly summary: KillStatsSummaryCards
  readonly boardRows: readonly KillStatsBoardRow[]
  readonly totalBoardCatalogRows: number
  readonly monsterRows: readonly KillStatsMonsterRow[]
}

export function computeAccountKey(host: string, realm: string, account: string): string {
  return JSON.stringify([host, realm, account].map((s) => s.trim().toLowerCase()))
}

/**
 * Resolves a localized monster / boss / SuperUnique display name from `.tbl` dictionaries.
 * Trims whitespace and falls back to English or canonical ID when an Act 5 Chinese `.tbl`
 * entry is space-padded (`"               "`).
 */
export function resolveLocalizedMonsterName(
  nameKey: string,
  fallbackId: string,
  lang: GameLang,
): string {
  const tblLang = lang === 'en' ? 'ENG' : 'CHI'
  const primary = resolveTblKey(nameKey, tblLang)?.trim()
  if (primary && primary.length > 0) {
    return primary
  }
  const engFallback = resolveTblKey(nameKey, 'ENG')?.trim()
  if (engFallback && engFallback.length > 0) {
    return engFallback
  }
  const trimmedKey = nameKey.trim()
  return trimmedKey.length > 0 ? trimmedKey : fallbackId
}

/**
 * Resolves localized character class name (`0..6`) via `CHAR_CLASS_NAMES` and `resolveTblKey`.
 */
export function resolveCharacterClassName(charClass: CharClassId, lang: GameLang): string {
  const key = CHAR_CLASS_NAMES[charClass] ?? 'Amazon'
  const tblLang = lang === 'en' ? 'ENG' : 'CHI'
  const resolved = resolveTblKey(key, tblLang)?.trim()
  return resolved && resolved.length > 0 ? resolved : key
}

let cachedBoardCatalog: readonly KillStatsBoardCatalogEntry[] | null = null

/**
 * Derives the exact 86-row Boss & SuperUnique catalog strictly from 1.13c data:
 * - 24 killable `MonStats.txt` rows with `boss === true`
 * - 66 `SuperUniques.txt` rows (`getSuperUniqueByIndex(0..65)`)
 * - Minus the 4 overlapping rows where `bossKind.id === su.monsterId`:
 *   - `229:radament` -> `SU10` (`Radament`)
 *   - `250:summoner` -> `SU18` (`The Summoner`)
 *   - `365:griswold` -> `SU5` (`Griswold`)
 *   - `526:nihlathakboss` -> `SU60` (`Nihlathak Boss`)
 */
export function getBossSuperUniqueBoardCatalog(): readonly KillStatsBoardCatalogEntry[] {
  if (cachedBoardCatalog) {
    return cachedBoardCatalog
  }

  const killableBossByMonsterId = new Map<
    string,
    { readonly hcIdx: number; readonly id: string; readonly nameKey: string }
  >()
  const killableBossList: {
    readonly hcIdx: number
    readonly id: string
    readonly nameKey: string
  }[] = []

  const monsterIdToHcIdx = new Map<string, number>()
  for (let hcIdx = 0; hcIdx <= MONSTATS_MAX_HCIDX; hcIdx++) {
    const kind = getMonsterKindByClassId(hcIdx)
    if (!kind) continue
    monsterIdToHcIdx.set(kind.id, hcIdx)
    if (isCountableBossClass(hcIdx)) {
      const entry = { hcIdx, id: kind.id, nameKey: kind.nameKey }
      killableBossList.push(entry)
      killableBossByMonsterId.set(kind.id, entry)
    }
  }

  const mergedBossHcIdxSet = new Set<number>()
  const suEntries: KillStatsBoardCatalogEntry[] = []

  for (let suIdx = 0; suIdx < SUPERUNIQUE_COUNT; suIdx++) {
    const su = getSuperUniqueByIndex(suIdx)
    if (!su) {
      throw new Error(`Missing SuperUnique definition at index ${suIdx}`)
    }
    const overlappingBoss = killableBossByMonsterId.get(su.monsterId)
    if (overlappingBoss) {
      mergedBossHcIdxSet.add(overlappingBoss.hcIdx)
    }
    const baseHcIdx = monsterIdToHcIdx.get(su.monsterId) ?? -1
    suEntries.push({
      key: `superunique:${suIdx}`,
      rowKind: 'superunique',
      subject: suIdx,
      canonicalId: su.id,
      baseMonsterId: su.monsterId,
      baseHcIdx,
      mergedBossHcIdx: overlappingBoss ? overlappingBoss.hcIdx : null,
      nameKey: su.nameKey,
    })
  }

  const standaloneBossEntries: KillStatsBoardCatalogEntry[] = []
  for (const boss of killableBossList) {
    if (mergedBossHcIdxSet.has(boss.hcIdx)) {
      continue
    }
    standaloneBossEntries.push({
      key: `boss:${boss.hcIdx}`,
      rowKind: 'boss',
      subject: boss.hcIdx,
      canonicalId: boss.id,
      baseMonsterId: boss.id,
      baseHcIdx: boss.hcIdx,
      mergedBossHcIdx: null,
      nameKey: boss.nameKey,
    })
  }

  cachedBoardCatalog = [...standaloneBossEntries, ...suEntries]
  return cachedBoardCatalog
}

interface DifficultyAccumulator {
  normal: number
  nightmare: number
  hell: number
  lastAt: number | null
}

function createEmptyAccumulator(): DifficultyAccumulator {
  return {
    normal: 0,
    nightmare: 0,
    hell: 0,
    lastAt: null,
  }
}

function addTallyToAccumulator(
  acc: DifficultyAccumulator,
  difficulty: 0 | 1 | 2,
  amount: number,
  lastAt: number,
): void {
  if (amount <= 0) return
  if (difficulty === 0) {
    acc.normal += amount
  } else if (difficulty === 1) {
    acc.nightmare += amount
  } else if (difficulty === 2) {
    acc.hell += amount
  }
  if (acc.lastAt === null || lastAt > acc.lastAt) {
    acc.lastAt = lastAt
  }
}

/**
 * First-stage cross-replica G-counter summation:
 * Wait: in `KillStatsSnapshot.tallies`, multiple replicas may have rows for the same
 * `(charKey, kind, difficulty, subject)`. Each replica's row has already been G-counter
 * merged (`max` per replica) on write/import, so displayed totals sum across all replicas!
 */
function effectiveTallyCount(tally: KillTallyRecord, soloOnly: boolean): number {
  return soloOnly ? tally.soloCount : tally.count
}

function resolveActiveScope(
  requested: KillStatsScope | undefined,
  characters: readonly KillCharacterRecord[],
): KillStatsScope {
  if (!requested || requested.kind === 'all') {
    return { kind: 'all' }
  }
  if (requested.kind === 'character') {
    const exists = characters.some((c) => c.charKey === requested.charKey)
    return exists ? requested : { kind: 'all' }
  }
  const targetAccountKey = computeAccountKey(
    requested.host,
    requested.realm,
    requested.account,
  )
  const exists = characters.some(
    (c) => computeAccountKey(c.host, c.realm, c.account) === targetAccountKey,
  )
  return exists ? requested : { kind: 'all' }
}

function matchesScope(
  charKey: string,
  charByKey: ReadonlyMap<string, KillCharacterRecord>,
  scope: KillStatsScope,
): boolean {
  if (scope.kind === 'all') return true
  if (scope.kind === 'character') return charKey === scope.charKey
  const c = charByKey.get(charKey)
  if (!c) return false
  return (
    computeAccountKey(c.host, c.realm, c.account) ===
    computeAccountKey(scope.host, scope.realm, scope.account)
  )
}

export function buildKillStatsViewModel(
  snapshot: KillStatsSnapshot,
  options: KillStatsViewOptions = {},
): KillStatsViewModel {
  const soloOnly = Boolean(options.soloOnly)
  const showUnkilled = options.showUnkilled ?? true
  const lang: GameLang = options.lang ?? 'zh'
  const monsterSearch = options.monsterSearch ?? ''
  const monsterSort: MonsterTableSort = options.monsterSort ?? {
    column: 'total',
    direction: 'desc',
  }

  const charByKey = new Map<string, KillCharacterRecord>()
  for (const c of snapshot.characters) {
    charByKey.set(c.charKey, c)
  }

  const scope = resolveActiveScope(options.scope, snapshot.characters)

  // Compute per-character monster kill totals for sidebar badges
  const charMonsterKills = new Map<string, number>()
  let totalAllAccountsKills = 0
  for (const t of snapshot.tallies) {
    if (t.kind !== 'monster') continue
    if (!charByKey.has(t.charKey)) continue
    const amt = effectiveTallyCount(t, soloOnly)
    if (amt <= 0) continue
    totalAllAccountsKills += amt
    charMonsterKills.set(t.charKey, (charMonsterKills.get(t.charKey) ?? 0) + amt)
  }

  // Group characters into account tree nodes
  const accountGroupMap = new Map<
    string,
    {
      host: string
      realm: string
      account: string
      latestSeenAt: number
      characters: KillStatsCharacterNode[]
    }
  >()

  let selectedCharacter: KillStatsCharacterNode | null = null

  for (const c of snapshot.characters) {
    const accountKey = computeAccountKey(c.host, c.realm, c.account)
    let group = accountGroupMap.get(accountKey)
    if (!group) {
      group = {
        host: c.host,
        realm: c.realm,
        account: c.account,
        latestSeenAt: c.lastSeenAt,
        characters: [],
      }
      accountGroupMap.set(accountKey, group)
    } else if (c.lastSeenAt >= group.latestSeenAt) {
      group.host = c.host
      group.realm = c.realm
      group.account = c.account
      group.latestSeenAt = c.lastSeenAt
    }

    const charNode: KillStatsCharacterNode = {
      charKey: c.charKey,
      host: c.host,
      realm: c.realm,
      account: c.account,
      charName: c.charName,
      charClass: c.charClass,
      className: resolveCharacterClassName(c.charClass, lang),
      level: c.level,
      hardcore: c.hardcore,
      expansion: c.expansion,
      ladder: c.ladder,
      totalKills: charMonsterKills.get(c.charKey) ?? 0,
      lastSeenAt: c.lastSeenAt,
    }
    group.characters.push(charNode)
    if (scope.kind === 'character' && c.charKey === scope.charKey) {
      selectedCharacter = charNode
    }
  }

  const accounts: KillStatsAccountNode[] = [...accountGroupMap.entries()]
    .sort(([keyA], [keyB]) => (keyA < keyB ? -1 : keyA > keyB ? 1 : 0))
    .map(([accountKey, group]) => {
      const sortedChars = [...group.characters].sort((a, b) =>
        a.charName.localeCompare(b.charName),
      )
      const totalKills = sortedChars.reduce((sum, ch) => sum + ch.totalKills, 0)
      return {
        accountKey,
        host: group.host,
        realm: group.realm,
        account: group.account,
        label: `${group.host} · ${group.realm} · ${group.account}`,
        totalKills,
        characters: sortedChars,
      }
    })

  // Aggregate tallies within the active scope
  const summaryAcc = createEmptyAccumulator()
  const monsterAccByHcIdx = new Map<number, DifficultyAccumulator>()
  const bossAccByHcIdx = new Map<number, DifficultyAccumulator>()
  const suAccByIdx = new Map<number, DifficultyAccumulator>()

  for (const t of snapshot.tallies) {
    if (!matchesScope(t.charKey, charByKey, scope)) continue
    const amt = effectiveTallyCount(t, soloOnly)
    if (amt <= 0) continue

    if (t.kind === 'monster') {
      if (!isCountableKillClass(t.subject)) continue
      addTallyToAccumulator(summaryAcc, t.difficulty, amt, t.lastAt)
      let mAcc = monsterAccByHcIdx.get(t.subject)
      if (!mAcc) {
        mAcc = createEmptyAccumulator()
        monsterAccByHcIdx.set(t.subject, mAcc)
      }
      addTallyToAccumulator(mAcc, t.difficulty, amt, t.lastAt)
    } else if (t.kind === 'boss') {
      if (!isCountableBossClass(t.subject)) continue
      let bAcc = bossAccByHcIdx.get(t.subject)
      if (!bAcc) {
        bAcc = createEmptyAccumulator()
        bossAccByHcIdx.set(t.subject, bAcc)
      }
      addTallyToAccumulator(bAcc, t.difficulty, amt, t.lastAt)
    } else if (t.kind === 'superunique') {
      if (t.subject < 0 || t.subject >= SUPERUNIQUE_COUNT) continue
      let sAcc = suAccByIdx.get(t.subject)
      if (!sAcc) {
        sAcc = createEmptyAccumulator()
        suAccByIdx.set(t.subject, sAcc)
      }
      addTallyToAccumulator(sAcc, t.difficulty, amt, t.lastAt)
    }
  }

  const summary: KillStatsSummaryCards = {
    normal: summaryAcc.normal,
    nightmare: summaryAcc.nightmare,
    hell: summaryAcc.hell,
    total: summaryAcc.normal + summaryAcc.nightmare + summaryAcc.hell,
  }

  // Build the 86-row Boss & SuperUnique Kill Board
  const catalog = getBossSuperUniqueBoardCatalog()

  // Count localized display name occurrences across all 86 catalog entries to disambiguate duplicates
  const nameCounts = new Map<string, number>()
  const localizedCatalog = catalog.map((entry) => {
    const nameZh = resolveLocalizedMonsterName(entry.nameKey, entry.canonicalId, 'zh')
    const nameEn = resolveLocalizedMonsterName(entry.nameKey, entry.canonicalId, 'en')
    const name = lang === 'en' ? nameEn : nameZh
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1)
    return { entry, name, nameZh, nameEn }
  })

  const allBoardRows: KillStatsBoardRow[] = localizedCatalog.map(
    ({ entry, name, nameZh, nameEn }) => {
      const acc = createEmptyAccumulator()
      if (entry.rowKind === 'boss') {
        const bAcc = bossAccByHcIdx.get(entry.subject)
        if (bAcc) {
          acc.normal += bAcc.normal
          acc.nightmare += bAcc.nightmare
          acc.hell += bAcc.hell
          acc.lastAt = bAcc.lastAt
        }
      } else {
        const sAcc = suAccByIdx.get(entry.subject)
        if (sAcc) {
          acc.normal += sAcc.normal
          acc.nightmare += sAcc.nightmare
          acc.hell += sAcc.hell
          acc.lastAt = sAcc.lastAt
        }
        if (entry.mergedBossHcIdx !== null) {
          const bAcc = bossAccByHcIdx.get(entry.mergedBossHcIdx)
          if (bAcc) {
            acc.normal += bAcc.normal
            acc.nightmare += bAcc.nightmare
            acc.hell += bAcc.hell
            if (
              bAcc.lastAt !== null &&
              (acc.lastAt === null || bAcc.lastAt > acc.lastAt)
            ) {
              acc.lastAt = bAcc.lastAt
            }
          }
        }
      }

      const total = acc.normal + acc.nightmare + acc.hell
      const hasDuplicateName = (nameCounts.get(name) ?? 0) > 1

      return {
        ...entry,
        name,
        nameZh,
        nameEn,
        subtitle: hasDuplicateName ? entry.canonicalId : null,
        normal: acc.normal,
        nightmare: acc.nightmare,
        hell: acc.hell,
        total,
        lastAt: total > 0 ? acc.lastAt : null,
      }
    },
  )

  const boardRows = showUnkilled
    ? allBoardRows
    : allBoardRows.filter((row) => row.total > 0)

  // Build Monster Type × Difficulty Table (all killed MonStats rows in active scope/filter)
  const rawMonsterRows: KillStatsMonsterRow[] = []
  for (const [hcIdx, mAcc] of monsterAccByHcIdx.entries()) {
    const total = mAcc.normal + mAcc.nightmare + mAcc.hell
    if (total <= 0) continue
    const kind = getMonsterKindByClassId(hcIdx)
    if (!kind) continue
    const nameZh = resolveLocalizedMonsterName(kind.nameKey, kind.id, 'zh')
    const nameEn = resolveLocalizedMonsterName(kind.nameKey, kind.id, 'en')
    const name = lang === 'en' ? nameEn : nameZh
    rawMonsterRows.push({
      hcIdx,
      id: kind.id,
      nameKey: kind.nameKey,
      name,
      nameZh,
      nameEn,
      normal: mAcc.normal,
      nightmare: mAcc.nightmare,
      hell: mAcc.hell,
      total,
      lastAt: mAcc.lastAt,
    })
  }

  const normalizedQuery = monsterSearch.trim().toLowerCase()
  const filteredMonsterRows =
    normalizedQuery.length === 0
      ? rawMonsterRows
      : rawMonsterRows.filter(
          (row) =>
            row.nameZh.toLowerCase().includes(normalizedQuery) ||
            row.nameEn.toLowerCase().includes(normalizedQuery) ||
            row.id.toLowerCase().includes(normalizedQuery) ||
            String(row.hcIdx).includes(normalizedQuery),
        )

  const dirMultiplier = monsterSort.direction === 'asc' ? 1 : -1
  const sortedMonsterRows = [...filteredMonsterRows].sort((a, b) => {
    let cmp = 0
    switch (monsterSort.column) {
      case 'hcIdx':
        cmp = a.hcIdx - b.hcIdx
        break
      case 'id':
        cmp = a.id.localeCompare(b.id)
        break
      case 'name':
        cmp = a.name.localeCompare(b.name, lang === 'en' ? 'en' : 'zh-CN')
        break
      case 'normal':
        cmp = a.normal - b.normal
        break
      case 'nightmare':
        cmp = a.nightmare - b.nightmare
        break
      case 'hell':
        cmp = a.hell - b.hell
        break
      case 'total':
      default:
        cmp = a.total - b.total
        break
    }
    if (cmp !== 0) {
      return cmp * dirMultiplier
    }
    return a.hcIdx - b.hcIdx
  })

  return {
    scope,
    soloOnly,
    showUnkilled,
    lang,
    monsterSearch,
    monsterSort,
    totalAllAccountsKills,
    accounts,
    selectedCharacter,
    summary,
    boardRows,
    totalBoardCatalogRows: catalog.length,
    monsterRows: sortedMonsterRows,
  }
}
