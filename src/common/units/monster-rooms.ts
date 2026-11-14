/**
 * Room-Local Monster Clustering and Placement.
 *
 * Replaces global spiral monster placement with authentic Diablo II room-based
 * spatial clustering and allocation. In Diablo II, monsters are partitioned into
 * rooms (sectors of ~20-30 cells outdoors, or discrete maze preset pieces indoors),
 * avoiding player safe zones (towns, waypoint clearings, level entrances), with
 * landmark SuperUniques fixed to their specific room and minions clustered tightly
 * in camp rings around their leader.
 */
import type { CombatTerrain, CombatWorld, MonsterPack, SafeZone } from './unit-types.ts'
import { Rng } from '../rng/d2-rng.ts'

/**
 * A discrete spatial room or sector in a level.
 */
export interface MapRoom {
  readonly id: string | number
  readonly x: number       // world/scene pixels
  readonly y: number
  readonly width: number
  readonly height: number
  readonly cellX: number   // grid cell coordinates
  readonly cellY: number
  readonly cellsX: number
  readonly cellsY: number
  readonly isSafeZone?: boolean | undefined
  readonly isPreset?: boolean | undefined
}

/**
 * Options for partitioning a level map into rooms.
 */
export interface PartitionOptions {
  /** Room cell size for outdoor grid sector partitioning (default ~24 cells). */
  readonly roomCellSize?: number | undefined
  /** Discrete maze rooms from the dungeon generator (e.g. from maze.ts). */
  readonly mazeRooms?: readonly {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
    readonly id?: string | number | undefined
    readonly isPreset?: boolean | undefined
    readonly isSafeZone?: boolean | undefined
  }[] | undefined
  /** Circular exclusion zones where ordinary monster camps must not spawn. */
  readonly safeZones?: readonly {
    readonly x: number
    readonly y: number
    readonly radius: number
  }[] | undefined
  /** Cell pixel width (default 80 px). */
  readonly cellPixelWidth?: number | undefined
  /** Cell pixel height (default 80 px). */
  readonly cellPixelHeight?: number | undefined
  /** Uniform cell pixel size shorthand (default 80 px). */
  readonly cellPixelSize?: number | undefined
  /** Origin X offset in pixels (default 0). */
  readonly originX?: number | undefined
  /** Origin Y offset in pixels (default 0). */
  readonly originY?: number | undefined
}

/** Default camp radius for room-local monster clustering (48~64 pixels). */
export const PACK_RADIUS_PX = 64

/**
 * Check if a room boundary overlaps any safe zone circle.
 * Tests in both pixel space and cell space for maximum compatibility.
 */
function checkSafeZoneOverlap(
  x: number,
  y: number,
  width: number,
  height: number,
  cellX: number,
  cellY: number,
  cellsX: number,
  cellsY: number,
  safeZones?: readonly { readonly x: number; readonly y: number; readonly radius: number }[],
): boolean {
  if (safeZones === undefined || safeZones.length === 0) return false
  for (const sz of safeZones) {
    // Check in world pixel space
    const clampPxX = Math.max(x, Math.min(sz.x, x + width))
    const clampPxY = Math.max(y, Math.min(sz.y, y + height))
    const pxDistSq = (sz.x - clampPxX) ** 2 + (sz.y - clampPxY) ** 2
    if (pxDistSq <= sz.radius * sz.radius) return true

    // Check in cell space (in case safeZone coordinates were given in cells)
    const clampCellX = Math.max(cellX, Math.min(sz.x, cellX + cellsX))
    const clampCellY = Math.max(cellY, Math.min(sz.y, cellY + cellsY))
    const cellDistSq = (sz.x - clampCellX) ** 2 + (sz.y - clampCellY) ** 2
    if (cellDistSq <= sz.radius * sz.radius) return true
  }
  return false
}

/**
 * Partition a map into rooms.
 *
 * If `mazeRooms` are supplied (from dungeon generator), map them directly into `MapRoom`s.
 * Otherwise (wilderness / outdoors), partition the level into authentic ~20-30 cell rooms
 * (e.g. 24x24 cells = 120x120 subtiles), matching D2's room grid.
 * Automatically flag rooms overlapping `safeZones` as `isSafeZone = true`.
 *
 * @param cellsX - total level width in cells.
 * @param cellsY - total level height in cells.
 * @param options - partitioning options.
 * @returns partitioned MapRooms.
 */
export function partitionMapIntoRooms(
  cellsX: number,
  cellsY: number,
  options?: PartitionOptions,
): MapRoom[] {
  const cellWidth = options?.cellPixelWidth ?? options?.cellPixelSize ?? 80
  const cellHeight = options?.cellPixelHeight ?? (options?.cellPixelSize !== undefined ? options.cellPixelSize : 40)
  const originX = options?.originX ?? 0
  const originY = options?.originY ?? 0

  if (options?.mazeRooms !== undefined && options.mazeRooms.length > 0) {
    return options.mazeRooms.map((mr, index) => {
      const cellX = mr.x
      const cellY = mr.y
      const rCellsX = mr.width
      const rCellsY = mr.height
      const x = cellX * cellWidth + originX
      const y = cellY * cellHeight + originY
      const width = rCellsX * cellWidth
      const height = rCellsY * cellHeight
      const id = mr.id ?? index
      const isPreset = mr.isPreset ?? true
      const isSafeZone = mr.isSafeZone ?? checkSafeZoneOverlap(
        x, y, width, height, cellX, cellY, rCellsX, rCellsY, options.safeZones,
      )

      return {
        id,
        x,
        y,
        width,
        height,
        cellX,
        cellY,
        cellsX: rCellsX,
        cellsY: rCellsY,
        isPreset,
        ...(isSafeZone ? { isSafeZone: true } : {}),
      }
    })
  }

  // Wilderness / outdoors: grid partition into ~24x24 cell rooms
  const roomCellSize = options?.roomCellSize ?? 24
  const rooms: MapRoom[] = []
  let index = 0

  for (let cy = 0; cy < cellsY; cy += roomCellSize) {
    const rCellsY = Math.min(roomCellSize, cellsY - cy)
    for (let cx = 0; cx < cellsX; cx += roomCellSize) {
      const rCellsX = Math.min(roomCellSize, cellsX - cx)
      const x = cx * cellWidth + originX
      const y = cy * cellHeight + originY
      const width = rCellsX * cellWidth
      const height = rCellsY * cellHeight
      const isSafeZone = checkSafeZoneOverlap(
        x, y, width, height, cx, cy, rCellsX, rCellsY, options?.safeZones,
      )

      rooms.push({
        id: index++,
        x,
        y,
        width,
        height,
        cellX: cx,
        cellY: cy,
        cellsX: rCellsX,
        cellsY: rCellsY,
        isPreset: false,
        ...(isSafeZone ? { isSafeZone: true } : {}),
      })
    }
  }

  return rooms
}

/**
 * Allocate monster packs to rooms according to Diablo II rules:
 * - Distributes non-landmark packs across non-safe rooms (avoiding town, stair buffers).
 * - Fixed landmark packs (SuperUniques with `landmarkTile` or `fixedPosition`) route directly
 *   to the room covering their coordinates.
 * - Avoids over-crowding by balancing pack counts across candidate rooms based on room area.
 *
 * @param packs - list of monster packs to distribute.
 * @param rooms - candidate rooms.
 * @param seed - optional random seed for deterministic distribution.
 * @returns Map from each MapRoom to its allocated MonsterPack array.
 */
export function allocatePacksToRooms(
  packs: readonly MonsterPack[],
  rooms: readonly MapRoom[],
  seed?: number,
): Map<MapRoom, MonsterPack[]> {
  const allocation = new Map<MapRoom, MonsterPack[]>()
  for (const room of rooms) {
    allocation.set(room, [])
  }
  if (rooms.length === 0 || packs.length === 0) {
    return allocation
  }

  const landmarkPacks: MonsterPack[] = []
  const normalPacks: MonsterPack[] = []

  for (const pack of packs) {
    if (pack.fixedPosition !== undefined || pack.landmarkTile !== undefined) {
      landmarkPacks.push(pack)
    } else {
      normalPacks.push(pack)
    }
  }

  // 1. Fixed landmark SuperUniques route directly to their covering room
  for (const pack of landmarkPacks) {
    let targetRoom: MapRoom | undefined

    if (pack.fixedPosition !== undefined) {
      const fx = pack.fixedPosition.x
      const fy = pack.fixedPosition.y
      targetRoom = rooms.find(r => fx >= r.x && fx <= r.x + r.width && fy >= r.y && fy <= r.y + r.height)
      if (targetRoom === undefined) {
        // Fallback: nearest room center
        let minDist = Infinity
        for (const r of rooms) {
          const cx = r.x + r.width / 2
          const cy = r.y + r.height / 2
          const d = Math.hypot(fx - cx, fy - cy)
          if (d < minDist) {
            minDist = d
            targetRoom = r
          }
        }
      }
    } else if (pack.landmarkTile !== undefined) {
      const tx = pack.landmarkTile.tileX
      const ty = pack.landmarkTile.tileY
      targetRoom = rooms.find(r => tx >= r.cellX && tx < r.cellX + r.cellsX && ty >= r.cellY && ty < r.cellY + r.cellsY)
      if (targetRoom === undefined) {
        targetRoom = rooms.find(r => tx >= r.cellX && tx <= r.cellX + r.cellsX && ty >= r.cellY && ty <= r.cellY + r.cellsY)
      }
      if (targetRoom === undefined) {
        // Fallback: nearest room by cell center
        let minDist = Infinity
        for (const r of rooms) {
          const cx = r.cellX + r.cellsX / 2
          const cy = r.cellY + r.cellsY / 2
          const d = Math.hypot(tx - cx, ty - cy)
          if (d < minDist) {
            minDist = d
            targetRoom = r
          }
        }
      }
    }

    if (targetRoom !== undefined && allocation.has(targetRoom)) {
      allocation.get(targetRoom)!.push(pack)
    }
  }

  // 2. Normal packs: distribute to non-safe rooms, balancing by room area
  const candidateRooms = rooms.filter(r => !r.isSafeZone)
  if (candidateRooms.length === 0) {
    return allocation
  }

  const rng = new Rng(seed ?? 0x5eed)

  for (const pack of normalPacks) {
    // Score based on pack density: (currentCount + 1) / area
    let minScore = Infinity
    for (const r of candidateRooms) {
      const count = allocation.get(r)!.length
      const area = Math.max(1, r.cellsX * r.cellsY)
      const score = (count + 1) / area
      if (score < minScore) {
        minScore = score
      }
    }

    const bestRooms: MapRoom[] = []
    for (const r of candidateRooms) {
      const count = allocation.get(r)!.length
      const area = Math.max(1, r.cellsX * r.cellsY)
      const score = (count + 1) / area
      if (Math.abs(score - minScore) < 1e-9) {
        bestRooms.push(r)
      }
    }

    const picked = bestRooms[rng.int(0, bestRooms.length - 1)]!
    allocation.get(picked)!.push(pack)
  }

  return allocation
}

/**
 * Spawns a single monster pack inside a given room.
 */
function spawnSinglePackInRoom(
  world: CombatWorld,
  pack: MonsterPack,
  room: MapRoom,
  terrain: CombatTerrain,
): number {
  if (pack.members.length === 0) return 0

  const margin = Math.min(16, Math.max(2, room.width * 0.05), Math.max(2, room.height * 0.05))
  const minSpawnX = room.x + margin
  const maxSpawnX = room.x + room.width - margin
  const minSpawnY = room.y + margin
  const maxSpawnY = room.y + room.height - margin

  // 1. Leader placement near room center or fixed landmark position
  const startX = pack.fixedPosition !== undefined
    ? pack.fixedPosition.x
    : room.x + room.width / 2
  const startY = pack.fixedPosition !== undefined
    ? pack.fixedPosition.y
    : room.y + room.height / 2

  let leaderX = Math.max(minSpawnX, Math.min(maxSpawnX, startX))
  let leaderY = Math.max(minSpawnY, Math.min(maxSpawnY, startY))
  let leaderFound = false

  // Check initial point
  if (terrain.overlap(leaderX, leaderY) === 0) {
    leaderFound = true
  } else {
    // Spiral search outward
    const maxRadius = Math.max(room.width, room.height) / 2
    for (let step = 1; step <= 64; step += 1) {
      const angle = step * 2.399963
      const radius = Math.min(maxRadius, step * 8)
      const sx = Math.max(minSpawnX, Math.min(maxSpawnX, startX + Math.cos(angle) * radius))
      const sy = Math.max(minSpawnY, Math.min(maxSpawnY, startY + Math.sin(angle) * radius))
      if (terrain.overlap(sx, sy) === 0) {
        leaderX = sx
        leaderY = sy
        leaderFound = true
        break
      }
    }
  }

  // Grid fallback if spiral failed
  if (!leaderFound) {
    const stepX = Math.max(8, (maxSpawnX - minSpawnX) / 16)
    const stepY = Math.max(8, (maxSpawnY - minSpawnY) / 16)
    for (let gy = minSpawnY; gy <= maxSpawnY; gy += stepY) {
      for (let gx = minSpawnX; gx <= maxSpawnX; gx += stepX) {
        if (terrain.overlap(gx, gy) === 0) {
          leaderX = gx
          leaderY = gy
          leaderFound = true
          break
        }
      }
      if (leaderFound) break
    }
  }

  if (!leaderFound) return 0

  const leaderDef = pack.members[0]!
  world.monsters.push({
    index: world.monsters.length,
    stats: leaderDef,
    x: leaderX,
    y: leaderY,
    hp: leaderDef.hp,
    cooldown: 0,
    state: 'idle',
    facing: 0,
    hitFlash: 0,
    corpseTicks: 0,
  })
  let placed = 1

  // 2. Minions placed in tight camp ring (PACK_RADIUS_PX = 48~64) around leader
  const minions = pack.members.slice(1)
  let minionPlaced = 0
  let attempt = 0
  const maxAttempts = minions.length * 32
  const baseAngle = typeof room.id === 'number' ? room.id * 1.5 : 0.8
  const effectiveRadius = Math.min(PACK_RADIUS_PX, Math.max(16, Math.min(room.width, room.height) / 2 - margin))

  while (minionPlaced < minions.length && attempt < maxAttempts) {
    attempt += 1
    const angle = baseAngle + attempt * 2.399963
    const distFrac = Math.sqrt(attempt / (minions.length * 12))
    const radius = Math.min(effectiveRadius, 16 + (effectiveRadius - 16) * distFrac)
    let mx = leaderX + Math.cos(angle) * radius
    let my = leaderY + Math.sin(angle) * radius

    // Clamps within room bounding boxes
    mx = Math.max(minSpawnX, Math.min(maxSpawnX, mx))
    my = Math.max(minSpawnY, Math.min(maxSpawnY, my))

    // Respects terrain collisions
    if (terrain.overlap(mx, my) > 0) continue

    const minionDef = minions[minionPlaced]!
    world.monsters.push({
      index: world.monsters.length,
      stats: minionDef,
      x: mx,
      y: my,
      hp: minionDef.hp,
      cooldown: 0,
      state: 'idle',
      facing: 0,
      hitFlash: 0,
      corpseTicks: 0,
    })
    minionPlaced += 1
    placed += 1
  }

  return placed
}

/**
 * Spawns monster pack(s) inside the boundaries of the specified `room`.
 *
 * Leader is positioned at a clear open sub-tile near the room's interior center;
 * minions are placed in a tight camp ring (PACK_RADIUS_PX = 48~64) around the leader.
 * Respects terrain collisions (terrain.overlap(x, y) === 0) and clamps within room
 * bounding boxes (x in [minX + margin, maxX - margin]).
 *
 * @param world - the world to populate.
 * @param pack - the pack or packs to spawn.
 * @param room - the room boundary to spawn within.
 * @param terrain - collision predicate.
 * @returns how many monsters were placed.
 */
export function spawnPacksInRoom(
  world: CombatWorld,
  pack: MonsterPack | readonly MonsterPack[],
  room: MapRoom,
  terrain: CombatTerrain,
): number {
  if (Array.isArray(pack)) {
    let count = 0
    for (const p of pack) {
      count += spawnSinglePackInRoom(world, p, room, terrain)
    }
    return count
  }
  return spawnSinglePackInRoom(world, pack as MonsterPack, room, terrain)
}

/**
 * Options for `spawnMonsterPacksByRooms`.
 */
export interface SpawnMonsterPacksByRoomsOptions {
  readonly seed?: number | undefined
  readonly safeZones?: readonly SafeZone[] | undefined
  readonly spread?: number | undefined
}

/**
 * Modern, clean replacement for `spawnMonsterPacks`, allocating packs across rooms
 * and clustering members tightly within their assigned room boundaries.
 *
 * Also maintains backwards compatibility if plain packs with a center point are passed.
 *
 * @param world - world to populate.
 * @param packs - monster packs to spawn.
 * @param roomsOrAround - room array or fallback center point.
 * @param terrain - collision predicate.
 * @param options - allocation options or safe zones.
 * @returns total monsters placed.
 */
export function spawnMonsterPacksByRooms(
  world: CombatWorld,
  packs: readonly MonsterPack[],
  roomsOrAround: readonly MapRoom[] | { readonly x: number; readonly y: number },
  terrain: CombatTerrain,
  options?: SpawnMonsterPacksByRoomsOptions | readonly SafeZone[],
): number {
  if (packs.length === 0) return 0

  let safeZones: readonly SafeZone[] | undefined
  let seed: number | undefined
  let spread = 600

  if (Array.isArray(options)) {
    safeZones = options
  } else if (options !== undefined) {
    const opts = options as SpawnMonsterPacksByRoomsOptions
    safeZones = opts.safeZones
    seed = opts.seed
    if (opts.spread !== undefined) {
      spread = opts.spread
    }
  }

  if (!Array.isArray(roomsOrAround)) {
    const around = roomsOrAround as { readonly x: number; readonly y: number }
    const syntheticRooms = partitionMapIntoRooms(64, 64, {
      roomCellSize: 16,
      cellPixelSize: 80,
      originX: around.x - spread,
      originY: around.y - spread,
      safeZones,
    })
    return spawnMonsterPacksByRooms(world, packs, syntheticRooms, terrain, {
      safeZones,
      seed,
    })
  }

  const rooms = roomsOrAround as readonly MapRoom[]
  if (rooms.length === 0) return 0

  const allocation = allocatePacksToRooms(packs, rooms, seed)
  let totalPlaced = 0
  for (const [room, roomPacks] of allocation) {
    for (const pack of roomPacks) {
      totalPlaced += spawnPacksInRoom(world, pack, room, terrain)
    }
  }
  return totalPlaced
}

function isInsideSafeZone(x: number, y: number, safeZones: readonly SafeZone[] | undefined): boolean {
  if (safeZones === undefined || safeZones.length === 0) return false
  for (const sz of safeZones) {
    if (Math.hypot(x - sz.x, y - sz.y) < sz.radius) return true
  }
  return false
}

export function spawnMonsterPacks(
  world: CombatWorld,
  packs: readonly MonsterPack[],
  around: { readonly x: number; readonly y: number },
  spread: number,
  terrain: CombatTerrain,
  safeZones?: readonly SafeZone[],
  rooms?: readonly MapRoom[],
  seed = 0x6ac690c5,
): number {
  if (rooms !== undefined && rooms.length > 0) {
    const count = spawnMonsterPacksByRooms(world, packs, rooms, terrain, safeZones !== undefined ? { safeZones } : undefined)
    for (const m of world.monsters) {
      if (m.dwInitSeed === undefined) {
        m.dwInitSeed = (((seed ^ Math.imul(m.index + 1, 0x9e3779b9)) >>> 0) || 1)
      }
    }
    return count
  }
  if (packs.length === 0) return 0
  let placed = 0
  let campIndex = 0
  let attempt = 0
  const attemptLimit = packs.length * 32
  while (campIndex < packs.length && attempt < attemptLimit) {
    const pack = packs[campIndex]!
    let campX: number
    let campY: number
    let angle: number

    if (pack.fixedPosition !== undefined) {
      campX = pack.fixedPosition.x
      campY = pack.fixedPosition.y
      angle = campIndex * 2.399963
      if (terrain.overlap(campX, campY) > 0) {
        let foundClear = false
        for (let searchStep = 1; searchStep <= 16; searchStep += 1) {
          const sAngle = searchStep * 2.399963
          const sx = campX + Math.cos(sAngle) * (searchStep * 12)
          const sy = campY + Math.sin(sAngle) * (searchStep * 12)
          if (terrain.overlap(sx, sy) === 0) {
            campX = sx
            campY = sy
            foundClear = true
            break
          }
        }
        if (!foundClear) {
          campIndex += 1
          continue
        }
      }
    } else {
      attempt += 1
      angle = attempt * 2.399963
      const radius = spread * Math.sqrt(attempt / (packs.length * 24))
      campX = around.x + Math.cos(angle) * radius
      campY = around.y + Math.sin(angle) * radius
      if (isInsideSafeZone(campX, campY, safeZones)) continue
      if (terrain.overlap(campX, campY) > 0) continue
    }

    campIndex += 1
    let memberAttempt = 0
    let memberPlaced = 0
    while (memberPlaced < pack.members.length && memberAttempt < pack.members.length * 16) {
      const memberAngle = angle + memberAttempt * 2.399963
      const memberRadius = memberAttempt === 0
        ? 0
        : PACK_RADIUS_PX * Math.sqrt(memberAttempt / (pack.members.length * 12))
      memberAttempt += 1
      const x = campX + Math.cos(memberAngle) * memberRadius
      const y = campY + Math.sin(memberAngle) * memberRadius
      if (pack.fixedPosition === undefined && isInsideSafeZone(x, y, safeZones)) continue
      if (terrain.overlap(x, y) > 0) continue
      const definition = pack.members[memberPlaced]!
      const idx = world.monsters.length
      world.monsters.push({
        index: idx,
        stats: definition,
        x, y,
        hp: definition.hp,
        cooldown: 0,
        state: 'idle',
        facing: 0,
        hitFlash: 0,
        corpseTicks: 0,
        dwInitSeed: (((seed ^ Math.imul(idx + 1, 0x9e3779b9)) >>> 0) || 1),
      })
      memberPlaced += 1
      placed += 1
    }
  }
  return placed
}
