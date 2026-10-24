/**
 * Server Room Streamer & Room-Local Monster Pack Spawner (Diablo II v1.13c).
 *
 * Wraps and re-exports `MonsterStreamingManager` (`src/common/units/monster-streaming.ts`)
 * and room-partition/pack-allocation algorithms (`src/common/units/monster-rooms.ts`),
 * adding multi-player (`1..8` players) active room streaming support (`RoomStreamer`)
 * for `GameInstance`.
 */

import {
  PACK_RADIUS_PX,
  allocatePacksToRooms,
  partitionMapIntoRooms,
  spawnMonsterPacksByRooms,
  spawnPacksInRoom,
  type MapRoom,
  type PartitionOptions,
} from '../../common/units/monster-rooms.ts'
import {
  MonsterStreamingManager,
  distanceToRoom,
  type MonsterStreamingOptions,
  type StreamingRoomDef,
  type StreamingRoomState,
} from '../../common/units/monster-streaming.ts'
import type { CombatTerrain, CombatWorld, MonsterPack } from '../../common/units/unit-types.ts'
import { Rng } from '../../common/rng/d2-rng.ts'
import {
  getCanonicalMonsterKinds,
  monsterBudget,
  planMonsterGroups,
  resolveEliteCandidates,
  rollEliteGroup,
  selectLevelTypes,
  type Difficulty,
  type LevelMonsterPlan,
  type MonsterGroup,
  type MonsterKind,
  type MonsterRank,
} from '../../common/units/monsters-data.ts'
import { getLevelMonsterPlan113c } from '../../common/world/level-monster-plans.ts'

export const DEFAULT_ACTIVATION_RADIUS = 1600
export const DEFAULT_DEACTIVATION_RADIUS = 2400

export {
  MonsterStreamingManager,
  distanceToRoom,
  PACK_RADIUS_PX,
  allocatePacksToRooms,
  partitionMapIntoRooms,
  spawnMonsterPacksByRooms,
  spawnPacksInRoom,
  type MonsterStreamingOptions,
  type MonsterStreamingOptions as RoomStreamerOptions,
  type StreamingRoomDef,
  type StreamingRoomState,
  type MapRoom,
  type PartitionOptions,
  type PartitionOptions as RoomPartitionOptions,
}

export interface FlexibleStreamingRoomDef {
  readonly id: string | number
  readonly bounds?: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number } | undefined
  readonly minX?: number | undefined
  readonly minY?: number | undefined
  readonly maxX?: number | undefined
  readonly maxY?: number | undefined
  readonly packs: readonly MonsterPack[]
  readonly room?: MapRoom | undefined
}

export interface RoomStreamTickResult {
  readonly activeRooms: readonly StreamingRoomState[]
  readonly activeRoomIds: readonly (string | number)[]
  readonly populatedRooms: readonly StreamingRoomState[]
}

function normalizeRoomDefs(roomDefs: readonly (StreamingRoomDef | FlexibleStreamingRoomDef)[]): StreamingRoomDef[] {
  return roomDefs.map((r) => {
    const bounds = r.bounds ?? {
      minX: (r as FlexibleStreamingRoomDef).minX ?? 0,
      minY: (r as FlexibleStreamingRoomDef).minY ?? 0,
      maxX: (r as FlexibleStreamingRoomDef).maxX ?? 0,
      maxY: (r as FlexibleStreamingRoomDef).maxY ?? 0,
    }
    return {
      id: r.id,
      bounds,
      packs: r.packs,
      ...(r.room !== undefined ? { room: r.room } : {}),
    }
  })
}

export type PlayerCoordInput =
  | { readonly x: number; readonly y: number }
  | readonly [number, number]

function normalizePlayerCoords(
  players: readonly PlayerCoordInput[],
): { readonly x: number; readonly y: number }[] {
  return players.map((p) =>
    Array.isArray(p)
      ? { x: p[0], y: p[1] }
      : { x: (p as { readonly x: number; readonly y: number }).x, y: (p as { readonly x: number; readonly y: number }).y },
  )
}

/**
 * Multi-player (`1..8` players) room streamer extending `MonsterStreamingManager`.
 * Activates and populates any room within `activationRadius` of ANY living/connected player,
 * and hibernates rooms only when ALL players are beyond `deactivationRadius`.
 */
export class RoomStreamer extends MonsterStreamingManager {
  constructor(
    world: CombatWorld,
    terrain: CombatTerrain,
    roomDefs: readonly (StreamingRoomDef | FlexibleStreamingRoomDef)[],
    options: MonsterStreamingOptions = {},
  ) {
    super(world, terrain, normalizeRoomDefs(roomDefs), options)
  }

  /**
   * Update room population and active/hibernated states across 1..8 player positions.
   */
  updateForPlayers(players: readonly PlayerCoordInput[]): RoomStreamTickResult {
    const normPlayers = normalizePlayerCoords(players)
    if (normPlayers.length === 1) {
      this.update(normPlayers[0]!.x, normPlayers[0]!.y)
    } else if (normPlayers.length > 1) {
      for (const room of this.rooms) {
        let minDist = Number.POSITIVE_INFINITY
        for (const p of normPlayers) {
          const d = distanceToRoom(p.x, p.y, room.bounds)
          if (d < minDist) minDist = d
        }
        if (minDist <= this.activationRadius) {
          if (!room.bPopulated) {
            this.populateRoom(room)
          }
          if (!room.active) {
            room.active = true
            for (const idx of room.monsterIndices) {
              const monster = this.world.monsters[idx]
              if (monster && monster.state !== 'dead') {
                monster.sleeping = false
              }
            }
          }
        } else if (minDist > this.deactivationRadius && room.active) {
          room.active = false
          for (const idx of room.monsterIndices) {
            const monster = this.world.monsters[idx]
            if (monster && monster.state !== 'dead') {
              monster.sleeping = true
            }
          }
        }
      }
    }
    const activeRooms = this.rooms.filter((r) => r.active)
    const populatedRooms = this.rooms.filter((r) => r.bPopulated)
    return {
      activeRooms,
      activeRoomIds: activeRooms.map((r) => r.id),
      populatedRooms,
    }
  }
}

/**
 * Standalone helper to advance a `RoomStreamer` across 1..8 player positions.
 */
export function streamActiveRooms113c(
  streamer: RoomStreamer,
  players: readonly PlayerCoordInput[],
): RoomStreamTickResult {
  return streamer.updateForPlayers(players)
}

// ---------------------------------------------------------------------------
// #1327: authoritative per-DRLG-room population for `GameInstance`.
//
// `GameInstance` works in world sub-tile coordinates and has no `CombatWorld`, so
// instead of `spawnPacksInRoom` it asks for spawn *specs*: the level's
// `Levels.txt` plan (`MonDen`, `NumMon`, `mon`/`nmon`/`umon`, `MonUMin`/`MonUMax`,
// `MonLvl*Ex`) is resolved once per level, and each DRLG room is populated
// exactly once, when a player first activates it, using the same density
// formula (`monsterBudget`), type draw (`selectLevelTypes`), pack sizing
// (`planMonsterGroups`) and elite rolls (`rollEliteGroup` / `MonUMod.txt`) the
// bake uses for whole levels.
// ---------------------------------------------------------------------------

/** Sub-tiles per DRLG tile (one `Levels.txt` density "cell"). */
export const SUBTILES_PER_TILE = 5

/** One DRLG room in world sub-tile coordinates. */
export interface PopulationRoomRect {
  /** Stable room index within the level (DRLG room order). */
  readonly index: number
  /** World sub-tile x of the room's top-left corner. */
  readonly x: number
  /** World sub-tile y of the room's top-left corner. */
  readonly y: number
  /** Width in sub-tiles. */
  readonly w: number
  /** Height in sub-tiles. */
  readonly h: number
  /** The room's DRLG init seed (`room1InitSeed`); every random choice in the room derives from it. */
  readonly seed: number
}

/** A level's population plan, resolved once when the level is first streamed. */
export interface LevelPopulationPlan113c {
  readonly levelId: number
  readonly difficulty: Difficulty
  readonly plan: LevelMonsterPlan
  /** `NumMon` types drawn (weighted by `Rarity`) from `mon1..10` / `nmon1..10`. */
  readonly types: readonly MonsterKind[]
  /** Candidates for champion / unique packs (`umon1..10`). */
  readonly eliteCandidates: readonly MonsterKind[]
  /** Elite pack count (rolled in `MonUMin..MonUMax`) distributed over room indices. */
  readonly elitePacksByRoom: ReadonlyMap<number, readonly number[]>
}

/** One monster to spawn into a room. */
export interface RoomSpawn113c {
  readonly kind: MonsterKind
  readonly rank: MonsterRank
  readonly modifiers: readonly string[]
  readonly x: number
  readonly y: number
  /** Index of the pack within the room. */
  readonly groupIndex: number
}

function difficultyName(difficulty: Difficulty | 0 | 1 | 2): Difficulty {
  if (typeof difficulty === 'string') return difficulty
  return difficulty === 2 ? 'hell' : difficulty === 1 ? 'nightmare' : 'normal'
}

/**
 * Resolve a level's monster plan (types + elite distribution) for room streaming.
 *
 * @param levelId - `Levels.txt` id (1..136).
 * @param difficulty - game difficulty.
 * @param rooms - every DRLG room of the level.
 * @param levelSeed - the level seed; same seed, same monsters.
 * @returns the plan, or null when the level populates nothing (towns, `MonDen` 0,
 *   no rooms, or an empty type pool).
 */
export function planLevelPopulation113c(
  levelId: number,
  difficulty: Difficulty | 0 | 1 | 2,
  rooms: readonly PopulationRoomRect[],
  levelSeed: number,
): LevelPopulationPlan113c | null {
  const diff = difficultyName(difficulty)
  const plan = getLevelMonsterPlan113c(levelId, diff)
  if (plan === null || plan.density <= 0) return null
  const usableRooms = rooms.filter(r => r.w > 0 && r.h > 0)
  if (usableRooms.length === 0) return null
  const kinds = getCanonicalMonsterKinds(diff)
  // Same independent streams `planLevelMonsters` uses, so a level's type draw does
  // not depend on how its rooms happen to be sized.
  const types = selectLevelTypes(plan, kinds, new Rng((levelSeed ^ 0x7b10) >>> 0), diff)
  if (types.length === 0) return null
  const eliteCandidates = resolveEliteCandidates(plan, types, kinds)
  const eliteRng = new Rng((levelSeed ^ 0x9e37) >>> 0)
  const elitePacks =
    plan.eliteMax <= 0 || eliteCandidates.length === 0
      ? 0
      : eliteRng.int(Math.min(plan.eliteMin, plan.eliteMax), plan.eliteMax)
  const elitePacksByRoom = new Map<number, number[]>()
  for (let i = 0; i < elitePacks; i += 1) {
    const room = usableRooms[eliteRng.int(0, usableRooms.length - 1)]!
    const list = elitePacksByRoom.get(room.index)
    if (list) list.push(i)
    else elitePacksByRoom.set(room.index, [i])
  }
  return { levelId, difficulty: diff, plan, types, eliteCandidates, elitePacksByRoom }
}

const PACK_MEMBER_OFFSETS: readonly (readonly [number, number])[] = (() => {
  const out: [number, number][] = []
  for (let r = 1; r <= 3; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r) out.push([dx, dy])
      }
    }
  }
  return out
})()

/** Attempts to find a walkable pack anchor inside the room before the pack is dropped. */
const PACK_ANCHOR_ATTEMPTS = 32

/**
 * Plan the monsters of one DRLG room.
 *
 * - Budget: `monsterBudget(roomTiles, MonDen)` (the 1.13c per-room density formula).
 * - Elite packs assigned to this room by {@link planLevelPopulation113c} are rolled
 *   first (`rollEliteGroup`: 20% champions of 2..4, 80% uniques + 3..6 minions with
 *   `MonUMod.txt` affixes) and count against the budget; the remainder becomes
 *   ordinary `MinGrp..MaxGrp` packs of the level's types.
 * - Every monster lands on a walkable sub-tile inside the room; a pack whose anchor
 *   cannot be placed is dropped (and reported via `onDroppedPack`), never moved
 *   onto a blocked cell or outside the room.
 *
 * @param level - from {@link planLevelPopulation113c}.
 * @param room - the room being activated.
 * @param isWalkable - world sub-tile walkability for ground monsters.
 * @param onDroppedPack - optional diagnostics hook.
 * @returns the spawns, in pack order.
 */
export function planRoomPopulation113c(
  level: LevelPopulationPlan113c,
  room: PopulationRoomRect,
  isWalkable: (x: number, y: number) => boolean,
  onDroppedPack?: (kind: MonsterKind, count: number) => void,
): RoomSpawn113c[] {
  if (room.w <= 0 || room.h <= 0) return []
  const rng = new Rng((room.seed ^ (level.levelId * 0x01000193)) >>> 0)
  const cells =
    Math.max(1, Math.floor(room.w / SUBTILES_PER_TILE)) *
    Math.max(1, Math.floor(room.h / SUBTILES_PER_TILE))
  const budget = monsterBudget(cells, level.plan.density)

  const groups: MonsterGroup[] = []
  let used = 0
  for (const packIndex of level.elitePacksByRoom.get(room.index) ?? []) {
    const group = rollEliteGroup(level.eliteCandidates, rng, packIndex)
    groups.push(group)
    used += group.count
  }
  const remaining = budget - used
  if (remaining > 0) {
    const kinds = getCanonicalMonsterKinds(level.difficulty)
    groups.push(
      ...planMonsterGroups({ ...level.plan, eliteMin: 0, eliteMax: 0 }, level.types, kinds, remaining, rng),
    )
  }

  const occupied = new Set<string>()
  const free = (x: number, y: number): boolean =>
    x >= room.x &&
    y >= room.y &&
    x < room.x + room.w &&
    y < room.y + room.h &&
    !occupied.has(`${x},${y}`) &&
    isWalkable(x, y)

  const spawns: RoomSpawn113c[] = []
  groups.forEach((group, groupIndex) => {
    let anchor: { x: number; y: number } | null = null
    for (let attempt = 0; attempt < PACK_ANCHOR_ATTEMPTS && anchor === null; attempt += 1) {
      const x = room.x + rng.int(0, room.w - 1)
      const y = room.y + rng.int(0, room.h - 1)
      if (free(x, y)) anchor = { x, y }
    }
    if (anchor === null) {
      onDroppedPack?.(group.kind, group.count)
      return
    }
    const cellsForPack: { x: number; y: number }[] = [anchor]
    occupied.add(`${anchor.x},${anchor.y}`)
    for (const [dx, dy] of PACK_MEMBER_OFFSETS) {
      if (cellsForPack.length >= group.count) break
      const x = anchor.x + dx
      const y = anchor.y + dy
      if (!free(x, y)) continue
      occupied.add(`${x},${y}`)
      cellsForPack.push({ x, y })
    }
    cellsForPack.forEach((cell, i) => {
      const rank: MonsterRank =
        group.rank === 'normal'
          ? 'normal'
          : group.rank === 'champion' || i === 0
            ? group.rank
            : 'minion'
      const modifiers = rank === 'champion' || (rank === 'unique' && i === 0) ? (group.modifiers ?? []) : []
      spawns.push({ kind: group.kind, rank, modifiers, x: cell.x, y: cell.y, groupIndex })
    })
  })
  return spawns
}
