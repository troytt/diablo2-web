/**
 * Server Authoritative 1.13c Drop Generator & Find Item (`#142`) Hork Pipeline
 * (`src/server/items/drop-generator.ts`).
 *
 * Exposes the canonical 1.13c drop pipeline with `ignoreNoDrop` (`noDropZero`) support for
 * Barbarian `Find Item (#142)` (`D2Game.dll` `SrvDo072` @ `0x6FC476D0` -> `0x6FCFE290`, `a7 = 1`),
 * where every `Picks` slot of the monster's `TreasureClassEx` rolls with `0%` `NoDrop` weight
 * while inheriting the Barbarian's active weapon-hand `%MF` and `%GF`.
 */

import type { Item } from '../../common/items/items.ts'
import type { Difficulty, MonsterRank } from '../../common/units/monsters-data.ts'
import {
  executeDropPipeline,
  executePendingMonsterDrop113c,
  getEmbeddedDropTables,
  resolveMonsterDropPending113c,
  type DropTables,
} from './drop-pipeline.ts'

export * from './drop-pipeline.ts'

export interface MonsterHorkDropOptions113c {
  readonly dropTables?: DropTables | undefined
  readonly subjectId: string
  readonly monsterIndex?: number | undefined
  readonly monsterLevel: number
  readonly monsterRank: MonsterRank
  readonly superUniqueId?: string | undefined
  readonly x?: number | undefined
  readonly y?: number | undefined
  readonly difficulty?: Difficulty | undefined
  readonly playerMf?: number | undefined
  readonly playerGf?: number | undefined
  readonly gamePlayers?: number | undefined
  readonly partyPlayers?: number | undefined
  readonly monsterPlayerCount?: number | undefined
  readonly seed: number
  readonly spawnedUniqueIds?: Set<number> | undefined
  /**
   * 1.13c `D2Game.dll` `0x6FCFE290` (`a7 = 1`): defaults to `true` for `Find Item (#142)` so
   * `NoDrop` weight is forced to `0` across all `TreasureClassEx` picks.
   */
  readonly ignoreNoDrop?: boolean | undefined
}

/**
 * Generates an independent 1.13c `Find Item (#142)` ("hork") drop round from a slain monster's
 * original `TreasureClassEx` (`Normal`, `Champion`, `Unique`, `Minion`, or `SuperUnique` such as
 * Travincal Council Member / Cow) with `ignoreNoDrop = true` (`NoDrop = 0` on every pick).
 */
export function generateMonsterHorkDrop113c(options: MonsterHorkDropOptions113c): Item[] {
  if (options.monsterRank === 'boss') {
    return []
  }
  const tables = options.dropTables ?? getEmbeddedDropTables()
  const difficulty: Difficulty = options.difficulty ?? 'normal'
  const pending = resolveMonsterDropPending113c(
    undefined,
    {
      kind: 'kill',
      x: options.x ?? 0,
      y: options.y ?? 0,
      subjectId: options.subjectId,
      ...(options.monsterIndex !== undefined ? { monsterIndex: options.monsterIndex } : {}),
      monsterLevel: options.monsterLevel,
      monsterRank: options.monsterRank,
      ...(options.superUniqueId !== undefined ? { superUniqueId: options.superUniqueId } : {}),
    },
    {
      dropTables: tables,
      difficulty,
      // Find Item (`sub_6FC659B0`) passes `bQuestDrop = 0` and never marks or rolls Act Boss quest TC4.
      wasBossAlreadyKilled: true,
      playerMf: options.playerMf ?? 0,
      playerGf: options.playerGf ?? 0,
      gamePlayers: options.gamePlayers ?? 1,
      partyPlayers: options.partyPlayers ?? 1,
      ...(options.monsterPlayerCount !== undefined
        ? { monsterPlayerCount: options.monsterPlayerCount }
        : {}),
      ...(options.spawnedUniqueIds !== undefined
        ? { spawnedUniqueIds: options.spawnedUniqueIds }
        : {}),
    },
  )
  if (!pending || pending.isBoss) {
    return []
  }
  const ignoreNoDrop = options.ignoreNoDrop !== false
  return executePendingMonsterDrop113c(
    tables,
    pending,
    difficulty,
    options.seed || 1,
    options.spawnedUniqueIds,
    { ignoreNoDrop, noDropZero: ignoreNoDrop },
  )
}
