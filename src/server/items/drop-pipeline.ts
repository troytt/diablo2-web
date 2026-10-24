/**
 * Server Authoritative 1.13c TreasureClass Drop Pipeline (`src/server/items/drop-pipeline.ts`).
 *
 * Re-exports the canonical 1.13c TreasureClassEx.txt drop pipeline from `src/common/items/`
 * and provides fail-fast server monster death drop resolution (SuperUnique TC lookup,
 * minion host TC3 inheritance, Act Boss first-kill Quest TC4 vs TC1, and death-animation drop gating).
 */

import * as dropTablesModule from '../../common/items/drop-tables.ts'
import {
  canItemBeRare,
  createDroppedItem,
  HELLFORGE_FLAWLESS_GEMS,
  HELLFORGE_NORMAL_GEMS,
  HELLFORGE_PERFECT_GEMS,
  HELLFORGE_RUNES_BY_DIFFICULTY,
  loadDropTables,
  LOW_QUALITY_PREFIXES,
  resolveItemTypeFlags,
  rollHellforgeDrop,
  rollItemEtherealAndSockets,
  shouldSpawnIdentifiedByDefault,
  type DropPipelineOptions,
  type DropTables,
  type EtherealAndSocketsRoll,
  type HellforgeDropResult,
  type ItemTypeFlags,
} from '../../common/items/drop-tables.ts'
import { getEmbeddedDropTables } from '../../common/items/embedded-drop-tables.ts'
import type { Item } from '../../common/items/items.ts'
import { D2Rng } from '../../common/rng/d2-rng.ts'
import {
  getMonsterTreasureClass,
  type Difficulty,
  type MonsterKind,
  type MonsterRank,
} from '../../common/units/monsters-data.ts'
import type {
  CombatEvent,
  KillerDropContext,
  Monster,
  PendingMonsterDrop,
} from '../../common/units/unit-types.ts'

export {
  canItemBeRare,
  createDroppedItem,
  getEmbeddedDropTables,
  HELLFORGE_FLAWLESS_GEMS,
  HELLFORGE_NORMAL_GEMS,
  HELLFORGE_PERFECT_GEMS,
  HELLFORGE_RUNES_BY_DIFFICULTY,
  loadDropTables,
  LOW_QUALITY_PREFIXES,
  resolveItemTypeFlags,
  rollHellforgeDrop,
  rollItemEtherealAndSockets,
  shouldSpawnIdentifiedByDefault,
  type DropPipelineOptions,
  type DropTables,
  type EtherealAndSocketsRoll,
  type HellforgeDropResult,
  type ItemTypeFlags,
  type KillerDropContext,
  type PendingMonsterDrop,
}

export * from '../../common/items/affix-generator.ts'
export {
  autoTcToTreasureClassNode,
  generateAutoTreasureClasses,
} from '../../common/items/auto-tc.ts'
export * from '../../common/items/item-ratio.ts'
export * from '../../common/items/item-upgrade.ts'
export * from '../../common/items/treasure-class.ts'
export * from '../../common/items/treasure-engine.ts'

/**
 * Execute the 1.13c TreasureClassEx drop pipeline for a single monster drop roll.
 * Delegates through the `dropTablesModule` namespace so `vi.spyOn` on either
 * `src/common/items/drop-tables.ts` or `src/server/items/drop-pipeline.ts` intercepts calls.
 */
export function executeDropPipeline(
  tablesOrOptions: DropTables | DropPipelineOptions,
  maybeOptions?: Omit<DropPipelineOptions, 'dropTables'> | D2Rng | number,
): Item[] {
  return dropTablesModule.executeDropPipeline(tablesOrOptions, maybeOptions)
}

export interface ResolveMonsterDropOptions {
  readonly dropTables: DropTables
  readonly difficulty?: Difficulty | undefined
  readonly monsterKinds?: ReadonlyMap<string, MonsterKind> | undefined
  readonly wasBossAlreadyKilled?: boolean | undefined
  readonly onMarkBossFirstKill?: ((subjectId: string, difficulty: Difficulty) => void) | undefined
  readonly playerMf?: number | undefined
  readonly playerGf?: number | undefined
  readonly gamePlayers?: number | undefined
  readonly partyPlayers?: number | undefined
}

/**
 * Resolves a monster kill event into a validated `PendingMonsterDrop` record using
 * authentic 1.13c SuperUnique / Minion (TC3) / Act Boss (Quest TC4 vs TC1) rules.
 * Throws fail-fast errors if `monsterLevel`, `monsterKind`, or `tcName` is invalid.
 */
export function resolveMonsterDropPending113c(
  monster: Monster | undefined,
  event: CombatEvent,
  options: ResolveMonsterDropOptions,
): PendingMonsterDrop | null {
  const {
    dropTables,
    difficulty = 'normal',
    monsterKinds,
    wasBossAlreadyKilled = false,
    onMarkBossFirstKill,
    playerMf = 0,
    playerGf = 0,
    gamePlayers = 1,
    partyPlayers = 1,
  } = options

  const subjectId = event.subjectId ?? monster?.stats.id ?? ''
  const monsterRank: MonsterRank = (event.monsterRank ?? monster?.stats.rank ?? 'normal') as MonsterRank
  const isMinion = monsterRank === 'minion'

  if (
    event.monsterLevel === undefined ||
    event.monsterLevel === null ||
    typeof event.monsterLevel !== 'number' ||
    Number.isNaN(event.monsterLevel) ||
    event.monsterLevel <= 0
  ) {
    throw new Error(
      `Drop pipeline failure: missing or invalid monsterLevel for death event (subjectId: "${event.subjectId}", superUniqueId: "${event.superUniqueId}", monsterLevel: ${event.monsterLevel})`,
    )
  }
  const monsterLevel = event.monsterLevel

  const suDef = event.superUniqueId
    ? (dropTables.superUniques.get(event.superUniqueId) ??
      (() => {
        const target = event.superUniqueId!.trim().toLowerCase()
        for (const [k, v] of dropTables.superUniques) {
          if (k.toLowerCase() === target || v.id.toLowerCase() === target || v.nameKey?.toLowerCase() === target) {
            return v
          }
        }
        return undefined
      })())
    : undefined

  let tcName = ''
  if (!isMinion && suDef) {
    tcName =
      typeof suDef.getTreasureClass === 'function' ? suDef.getTreasureClass(difficulty) : suDef.treasureClass
  }

  const monsterKind =
    dropTables.monsterKinds.get(subjectId) ??
    monsterKinds?.get(subjectId) ??
    (suDef ? (dropTables.monsterKinds.get(suDef.monsterId) ?? monsterKinds?.get(suDef.monsterId)) : undefined)

  if (!monsterKind && !suDef) {
    throw new Error(
      `Drop pipeline failure: unknown monster (subjectId: "${event.subjectId}", superUniqueId: "${event.superUniqueId}") not found in canonical drop tables`,
    )
  }

  const isActBoss = !isMinion && (monsterRank === 'boss' || Boolean(monsterKind?.boss && monsterKind.treasureClasses[3]))
  const monsterType = isMinion
    ? 3
    : (event.monsterType ??
      (isActBoss
        ? (wasBossAlreadyKilled ? 1 : 4)
        : monsterRank === 'unique'
          ? 3
          : monsterRank === 'champion'
            ? 2
            : 1))

  if (isActBoss && !wasBossAlreadyKilled && subjectId) {
    onMarkBossFirstKill?.(subjectId, difficulty)
  }

  if (!tcName && monsterKind) {
    tcName = getMonsterTreasureClass(monsterKind, difficulty, monsterType)
  }

  if (!tcName) {
    const hasAuthenticEmptyTc =
      (!monsterKind ||
        !monsterKind.treasureClasses ||
        monsterKind.treasureClasses.length === 0 ||
        monsterKind.treasureClasses[0] === '') &&
      (!suDef || !suDef.treasureClass || suDef.treasureClass === '')
    if (hasAuthenticEmptyTc) {
      return null
    }
    throw new Error(
      `Drop pipeline failure: corrupt or unresolvable treasure class for monster "${event.subjectId ?? event.superUniqueId}" on difficulty "${difficulty}"`,
    )
  }

  const tcExists = Boolean(
    dropTables.tcTable.get(tcName) || dropTables.autoTcTable?.get(tcName) || dropTables.getBase?.(tcName),
  )
  if (!tcExists) {
    throw new Error(
      `Drop pipeline failure: treasure class "${tcName}" resolved for monster "${event.subjectId ?? event.superUniqueId}" not found in drop tables`,
    )
  }

  const isBoss = isMinion ? false : Boolean(monsterKind?.boss)
  const isNoRatio = Boolean(monsterKind?.noRatio)

  return {
    monsterIndex: monster?.index ?? event.monsterIndex ?? -1,
    subjectId: event.subjectId ?? '',
    superUniqueId: event.superUniqueId,
    monsterLevel,
    monsterRank,
    monsterType,
    x: event.x,
    y: event.y,
    tcName,
    isBoss,
    isNoRatio,
    seed: monster?.dwInitSeed ?? 0,
    killerContext: {
      playerMf,
      playerGf,
      gamePlayers,
      partyPlayers,
    },
  }
}

/**
 * Executes `executeDropPipeline` for a `PendingMonsterDrop`.
 */
export function executePendingMonsterDrop113c(
  dropTables: DropTables,
  pending: PendingMonsterDrop,
  difficulty: Difficulty = 'normal',
  seed?: number,
): Item[] {
  if (pending.items) return [...(pending.items as Item[])]
  const dropSeed = seed ?? pending.seed
  if (!dropSeed) {
    throw new Error('executePendingMonsterDrop113c requires a non-zero monster seed')
  }
  return executeDropPipeline(dropTables, {
    tcName: pending.tcName,
    nLevel: pending.monsterLevel,
    monsterType: pending.monsterType,
    difficulty,
    gamePlayers: pending.killerContext.gamePlayers,
    partyPlayers: pending.killerContext.partyPlayers,
    playerMf: pending.killerContext.playerMf,
    playerGf: pending.killerContext.playerGf,
    isBoss: pending.isBoss,
    isNoRatio: pending.isNoRatio,
    monsterRng: new D2Rng(dropSeed),
  })
}

/**
 * Queues a pending drop on `monster` upon lethal damage. If `monster.deathGated` or `monster.deathTicks > 0`,
 * holds the drop on `monster.pendingDrop`; otherwise executes immediately via `onTriggerDrop`.
 */
export function queueMonsterDeathDrop113c(
  monster: Monster,
  event: CombatEvent,
  options: ResolveMonsterDropOptions,
  onTriggerDrop?: (monster: Monster, items: Item[]) => void,
): PendingMonsterDrop | null {
  if (monster.dropRolled) return null
  const pending = resolveMonsterDropPending113c(monster, event, options)
  if (!pending) return null
  monster.pendingDrop = pending
  if (monster.deathGated === true || (monster.deathTicks !== undefined && monster.deathTicks > 0)) {
    return pending
  }
  monster.dropRolled = true
  monster.animMode = 'dd'
  const items = executePendingMonsterDrop113c(options.dropTables, pending, options.difficulty ?? 'normal')
  monster.pendingDrop = undefined
  onTriggerDrop?.(monster, items)
  return pending
}

/**
 * Advances death animation countdown (`monster.deathTicks`) for dying monsters (`animMode === 'dt'`)
 * and triggers `executePendingMonsterDrop113c` when `deathTicks` reaches 0.
 */
export function tickPendingMonsterDrops113c(
  monsters: readonly Monster[],
  dropTables: DropTables,
  difficulty: Difficulty = 'normal',
  onTriggerDrop?: (monster: Monster, items: Item[]) => void,
): Array<{ readonly monster: Monster; readonly items: Item[] }> {
  const triggered: Array<{ readonly monster: Monster; readonly items: Item[] }> = []
  for (const monster of monsters) {
    if (monster.animMode === 'dt' && monster.pendingDrop && !monster.dropRolled) {
      if (monster.deathTicks !== undefined && monster.deathTicks > 0) {
        monster.deathTicks -= 1
        if (monster.deathTicks === 0) {
          const pending = monster.pendingDrop as PendingMonsterDrop
          monster.dropRolled = true
          monster.animMode = 'dd'
          const items = executePendingMonsterDrop113c(dropTables, pending, difficulty)
          monster.pendingDrop = undefined
          onTriggerDrop?.(monster, items)
          triggered.push({ monster, items })
        }
      }
    }
  }
  return triggered
}
