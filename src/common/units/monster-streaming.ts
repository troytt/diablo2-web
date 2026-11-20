/**
 * Diablo II D2Game.dll style Active/Sleeping Room Streaming and Lazy Room Population.
 *
 * Rather than eagerly instantiating every monster pack on frame 0, rooms begin
 * unpopulated (`bPopulated = false`). When the player approaches within
 * `activationRadius`, monsters are instantiated into `world.monsters` once and
 * only once (idempotent).
 *
 * When the player moves far away (> `deactivationRadius`), the room transitions to
 * sleeping (`active = false`) and all living monsters have `monster.sleeping = true`,
 * skipping all AI, aggro, cooldown calculations, and pathfinding in `tickMonsters`.
 *
 * When the player returns, monsters wake up (`monster.sleeping = false`) with their
 * exact positions, health, and cooldowns preserved. Dead monsters remain dead.
 */
import type { CombatTerrain, CombatWorld, MonsterPack, SafeZone } from './unit-types.ts'
import { spawnPacksInRoom } from './monster-rooms.ts'
import type { MapRoom } from './monster-rooms.ts'

/** Definition of a room holding unspawned monster pack blueprints. */
export interface StreamingRoomDef {
  readonly id: string | number
  readonly bounds: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number }
  readonly packs: readonly MonsterPack[]
  /**
   * Optional source `MapRoom` (carrying cell coordinates / safe-zone flags) used when
   * the room is lazily populated. When omitted one is synthesised from `bounds`.
   */
  readonly room?: MapRoom | undefined
}

/** Runtime state of a streaming room. */
export interface StreamingRoomState extends StreamingRoomDef {
  bPopulated: boolean
  active: boolean
  monsterIndices: number[]
}

/** Configuration options for the streaming manager. */
export interface MonsterStreamingOptions {
  /** Distance in pixels to populate and activate a room (default: 1600px ~ 1.5-2 screens). */
  activationRadius?: number
  /** Distance in pixels to deactivate and put a room to sleep (default: 2400px ~ 2.5-3 screens). */
  deactivationRadius?: number
  /** Optional callback invoked whenever a room is populated for the first time. */
  onSpawnRoom?: (room: StreamingRoomState) => void
  /** Optional safe zones to avoid when placing monsters inside rooms. */
  safeZones?: readonly SafeZone[]
}

/**
 * Calculates Euclidean distance from a point to an axis-aligned room bounding box.
 * Returns 0 if the point is within the bounding box.
 *
 * @param px - point x coordinate.
 * @param py - point y coordinate.
 * @param bounds - room axis-aligned bounds.
 * @returns Euclidean distance to the nearest point on the room boundary (or 0 if inside).
 */
export function distanceToRoom(
  px: number,
  py: number,
  bounds: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number },
): number {
  const minX = Math.min(bounds.minX, bounds.maxX)
  const maxX = Math.max(bounds.minX, bounds.maxX)
  const minY = Math.min(bounds.minY, bounds.maxY)
  const maxY = Math.max(bounds.minY, bounds.maxY)
  const dx = Math.max(minX - px, 0, px - maxX)
  const dy = Math.max(minY - py, 0, py - maxY)
  return Math.hypot(dx, dy)
}

/**
 * Manages lazy room population (`bPopulated`) and active/sleeping room streaming.
 */
export class MonsterStreamingManager {
  public world: CombatWorld
  public terrain: CombatTerrain
  public rooms: StreamingRoomState[]
  public activationRadius: number
  public deactivationRadius: number
  public options?: MonsterStreamingOptions | undefined

  constructor(
    world: CombatWorld,
    terrain: CombatTerrain,
    rooms: readonly StreamingRoomDef[],
    options?: MonsterStreamingOptions,
  ) {
    this.world = world
    this.terrain = terrain
    this.activationRadius = options?.activationRadius ?? 1600
    this.deactivationRadius = options?.deactivationRadius ?? 2400
    this.options = options
    this.rooms = rooms.map(r => ({
      id: r.id,
      bounds: r.bounds,
      packs: r.packs,
      room: r.room,
      bPopulated: false,
      active: false,
      monsterIndices: [],
    }))

    // On initialization, only the room containing the player spawn and adjacent rooms
    // within activationRadius are populated. Distant rooms remain unpopulated.
    this.update(this.world.player.x, this.world.player.y)
  }

  /**
   * Evaluates player distance to all rooms, populating unpopulated rooms within
   * activationRadius, waking active rooms, and putting distant rooms to sleep.
   *
   * @param playerX - player world x position.
   * @param playerY - player world y position.
   */
  update(playerX: number = this.world.player.x, playerY: number = this.world.player.y): void {
    for (const room of this.rooms) {
      const dist = distanceToRoom(playerX, playerY, room.bounds)

      if (dist <= this.activationRadius) {
        if (!room.bPopulated) {
          this.populateRoom(room)
        }
        room.active = true
        for (const idx of room.monsterIndices) {
          const monster = this.world.monsters[idx]
          if (monster) {
            monster.sleeping = false
          }
        }
      } else if (dist > this.deactivationRadius) {
        if (room.active) {
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
  }

  /**
   * Lazily instantiates a room's monster packs into `world.monsters`.
   *
   * Packs are placed as tight camps inside the room boundary (see
   * `spawnPacksInRoom`), mirroring D2's per-room monster groups, rather than
   * being scattered across the whole level. Sets `bPopulated = true` to
   * guarantee idempotency.
   */
  protected populateRoom(room: StreamingRoomState): void {
    if (room.bPopulated) return

    const startIndex = this.world.monsters.length
    const mapRoom = room.room ?? boundsToMapRoom(room.id, room.bounds)

    spawnPacksInRoom(this.world, room.packs, mapRoom, this.terrain)

    const endIndex = this.world.monsters.length
    for (let i = startIndex; i < endIndex; i += 1) {
      room.monsterIndices.push(i)
    }

    // Push any monster that landed inside a safe zone (waypoint / level entrance)
    // out to the safe zone perimeter so towns and warps stay clear.
    const safeZones = this.options?.safeZones
    if (safeZones !== undefined && safeZones.length > 0) {
      for (let i = startIndex; i < endIndex; i += 1) {
        const monster = this.world.monsters[i]
        if (monster === undefined) continue
        for (const zone of safeZones) {
          const dx = monster.x - zone.x
          const dy = monster.y - zone.y
          const dist = Math.hypot(dx, dy)
          if (dist >= zone.radius) continue
          const angle = dist > 1e-6 ? Math.atan2(dy, dx) : (i * 2.399963)
          monster.x = zone.x + Math.cos(angle) * (zone.radius + 8)
          monster.y = zone.y + Math.sin(angle) * (zone.radius + 8)
        }
      }
    }

    room.bPopulated = true
    this.options?.onSpawnRoom?.(room)
  }
}

/**
 * Builds a minimal `MapRoom` from pixel bounds when the caller did not supply one.
 *
 * @param id - room identifier (also seeds the camp ring angle).
 * @param bounds - axis-aligned pixel bounds of the room.
 * @returns a `MapRoom` usable by `spawnPacksInRoom`.
 */
function boundsToMapRoom(
  id: string | number,
  bounds: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number },
): MapRoom {
  const minX = Math.min(bounds.minX, bounds.maxX)
  const maxX = Math.max(bounds.minX, bounds.maxX)
  const minY = Math.min(bounds.minY, bounds.maxY)
  const maxY = Math.max(bounds.minY, bounds.maxY)
  return {
    id,
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    cellX: 0,
    cellY: 0,
    cellsX: 0,
    cellsY: 0,
  }
}
