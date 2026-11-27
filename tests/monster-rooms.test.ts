import { describe, expect, it } from 'vitest'
import {
  allocatePacksToRooms,
  partitionMapIntoRooms,
  spawnMonsterPacksByRooms,
  spawnPacksInRoom,
  PACK_RADIUS_PX,
  type MapRoom,
} from '../src/common/units/monster-rooms.ts'
import { createWorld } from '../src/server/ai/monster-ai.ts'
import type { CombatTerrain, MonsterPack, MonsterStats } from '../src/server/ai/monster-ai.ts'

/** Flat open ground everywhere. */
const OPEN: CombatTerrain = { overlap: () => 0 }

/**
 * Creates a simple monster stat record.
 */
function stats(id: string, hp = 30): MonsterStats {
  return {
    id,
    name: id,
    hp,
    damage: 5,
    cooldownTicks: 25,
    reach: 40,
    aggroRadius: 200,
    speed: 100,
    xp: 10,
  }
}

/**
 * Creates a test monster pack.
 */
function pack(id: string, count: number, extra?: Partial<MonsterPack>): MonsterPack {
  return {
    members: Array.from({ length: count }, (_, i) => stats(id, 30 + i)),
    ...extra,
  }
}

describe('Room-Local Monster Clustering and Placement', () => {
  describe('partitionMapIntoRooms', () => {
    it('partitions outdoor grid sectors into authentic ~20-30 cell rooms', () => {
      // 72x48 cells partitioned with roomCellSize = 24 -> 3 x 2 = 6 rooms
      const rooms = partitionMapIntoRooms(72, 48, { roomCellSize: 24, cellPixelSize: 80 })
      expect(rooms).toHaveLength(6)

      // All rooms should be 24x24 cells and 1920x1920 pixels
      for (const room of rooms) {
        expect(room.cellsX).toBe(24)
        expect(room.cellsY).toBe(24)
        expect(room.width).toBe(1920)
        expect(room.height).toBe(1920)
        expect(room.isPreset).toBe(false)
      }

      // Check cell grid coordinates
      expect(rooms[0]?.cellX).toBe(0)
      expect(rooms[0]?.cellY).toBe(0)
      expect(rooms[1]?.cellX).toBe(24)
      expect(rooms[1]?.cellY).toBe(0)
      expect(rooms[2]?.cellX).toBe(48)
      expect(rooms[2]?.cellY).toBe(0)
      expect(rooms[3]?.cellX).toBe(0)
      expect(rooms[3]?.cellY).toBe(24)
    })

    it('handles map dimensions that do not divide evenly by roomCellSize', () => {
      // 50x30 cells with roomCellSize = 24 -> 3 cols (24, 24, 2) x 2 rows (24, 6) = 6 rooms
      const rooms = partitionMapIntoRooms(50, 30, { roomCellSize: 24, cellPixelSize: 80 })
      expect(rooms).toHaveLength(6)

      const col2Row0 = rooms.find(r => r.cellX === 48 && r.cellY === 0)
      expect(col2Row0).toBeDefined()
      expect(col2Row0?.cellsX).toBe(2)
      expect(col2Row0?.cellsY).toBe(24)
      expect(col2Row0?.width).toBe(160)

      const col0Row1 = rooms.find(r => r.cellX === 0 && r.cellY === 24)
      expect(col0Row1).toBeDefined()
      expect(col0Row1?.cellsX).toBe(24)
      expect(col0Row1?.cellsY).toBe(6)
      expect(col0Row1?.height).toBe(480)
    })

    it('maps discrete maze rooms directly into MapRooms', () => {
      const mazeRooms = [
        { x: 0, y: 0, width: 24, height: 24 },
        { x: 24, y: 0, width: 24, height: 24 },
        { x: 24, y: 24, width: 12, height: 12 },
      ]
      const rooms = partitionMapIntoRooms(48, 48, { mazeRooms, cellPixelSize: 80 })
      expect(rooms).toHaveLength(3)

      expect(rooms[0]?.isPreset).toBe(true)
      expect(rooms[0]?.cellX).toBe(0)
      expect(rooms[0]?.cellY).toBe(0)
      expect(rooms[0]?.width).toBe(1920)

      expect(rooms[2]?.cellsX).toBe(12)
      expect(rooms[2]?.cellsY).toBe(12)
      expect(rooms[2]?.width).toBe(960)
      expect(rooms[2]?.height).toBe(960)
    })

    it('defaults cellHeight to 40 px when cellPixelSize is omitted (isometric 80x40)', () => {
      const rooms = partitionMapIntoRooms(24, 24, { roomCellSize: 24 })
      expect(rooms).toHaveLength(1)
      expect(rooms[0]?.width).toBe(24 * 80)
      expect(rooms[0]?.height).toBe(24 * 40)
    })

    it('automatically flags rooms overlapping safe zones as isSafeZone', () => {
      const safeZones = [
        { x: 500, y: 500, radius: 160 },
      ]
      const rooms = partitionMapIntoRooms(72, 48, { roomCellSize: 24, cellPixelSize: 80, safeZones })
      expect(rooms).toHaveLength(6)

      // Room 0 covers [0, 1920] x [0, 1920], overlaps (500, 500)
      expect(rooms[0]?.isSafeZone).toBe(true)

      // Distant rooms should not be safe zones
      const distantRoom = rooms.find(r => r.cellX === 48 && r.cellY === 24)
      expect(distantRoom?.isSafeZone).toBeUndefined()
    })
  })

  describe('allocatePacksToRooms', () => {
    it('distributes normal packs to non-safe rooms and avoids safe rooms', () => {
      const rooms: MapRoom[] = [
        { id: 0, x: 0, y: 0, width: 1000, height: 1000, cellX: 0, cellY: 0, cellsX: 10, cellsY: 10, isSafeZone: true },
        { id: 1, x: 1000, y: 0, width: 1000, height: 1000, cellX: 10, cellY: 0, cellsX: 10, cellsY: 10 },
        { id: 2, x: 2000, y: 0, width: 1000, height: 1000, cellX: 20, cellY: 0, cellsX: 10, cellsY: 10 },
      ]
      const packs = [
        pack('fallen', 3),
        pack('zombie', 4),
        pack('skeleton', 3),
        pack('quillrat', 2),
      ]

      const allocation = allocatePacksToRooms(packs, rooms, 12345)

      // Safe room (id: 0) must receive NO normal packs
      expect(allocation.get(rooms[0]!)).toHaveLength(0)

      // Remaining packs must be distributed between room 1 and room 2
      const room1Count = allocation.get(rooms[1]!)?.length ?? 0
      const room2Count = allocation.get(rooms[2]!)?.length ?? 0
      expect(room1Count + room2Count).toBe(4)
      expect(room1Count).toBeGreaterThan(0)
      expect(room2Count).toBeGreaterThan(0)
    })

    it('returns empty allocation when all rooms are safe zones (does not place monsters in towns)', () => {
      const safeRooms: MapRoom[] = [
        { id: 'town1', x: 0, y: 0, width: 800, height: 800, cellX: 0, cellY: 0, cellsX: 10, cellsY: 10, isPreset: false, isSafeZone: true },
        { id: 'town2', x: 800, y: 0, width: 800, height: 800, cellX: 10, cellY: 0, cellsX: 10, cellsY: 10, isPreset: false, isSafeZone: true },
      ]
      const packs = [pack('fallen', 3), pack('zombie', 4)]
      const allocation = allocatePacksToRooms(packs, safeRooms, 12345)
      expect(allocation.get(safeRooms[0]!)).toEqual([])
      expect(allocation.get(safeRooms[1]!)).toEqual([])
    })

    it('balances pack counts across candidate rooms based on room area', () => {
      // Room Small: 10x10 cells (area 100)
      // Room Large: 20x20 cells (area 400 - 4x larger)
      const roomSmall: MapRoom = { id: 'small', x: 0, y: 0, width: 800, height: 800, cellX: 0, cellY: 0, cellsX: 10, cellsY: 10 }
      const roomLarge: MapRoom = { id: 'large', x: 800, y: 0, width: 1600, height: 1600, cellX: 10, cellY: 0, cellsX: 20, cellsY: 20 }
      const rooms = [roomSmall, roomLarge]

      const packs = Array.from({ length: 10 }, (_, i) => pack(`mob_${String(i)}`, 3))
      const allocation = allocatePacksToRooms(packs, rooms, 42)

      const smallCount = allocation.get(roomSmall)?.length ?? 0
      const largeCount = allocation.get(roomLarge)?.length ?? 0

      expect(smallCount + largeCount).toBe(10)
      // Large room has 4x area, so it should receive significantly more packs without overcrowding small room
      expect(largeCount).toBeGreaterThan(smallCount * 2)
    })

    it('routes landmark SuperUnique packs with landmarkTile to covering room', () => {
      const roomA: MapRoom = { id: 'A', x: 0, y: 0, width: 1920, height: 1920, cellX: 0, cellY: 0, cellsX: 24, cellsY: 24 }
      const roomB: MapRoom = { id: 'B', x: 1920, y: 0, width: 1920, height: 1920, cellX: 24, cellY: 0, cellsX: 24, cellsY: 24 }
      const rooms = [roomA, roomB]

      // Bishibosh at landmark tile (tileX: 30, tileY: 10) falls inside room B (cellX in [24, 48))
      const bishiboshPack = pack('bishibosh', 5, {
        superUniqueId: 'Bishibosh',
        landmarkTile: { tileX: 30, tileY: 10 },
      })
      const normalPack = pack('fallen', 3)

      const allocation = allocatePacksToRooms([bishiboshPack, normalPack], rooms, 100)

      const roomBPacks = allocation.get(roomB) ?? []
      expect(roomBPacks).toContain(bishiboshPack)
    })

    it('routes landmark SuperUnique packs with fixedPosition to covering room', () => {
      const roomA: MapRoom = { id: 'A', x: 0, y: 0, width: 1000, height: 1000, cellX: 0, cellY: 0, cellsX: 10, cellsY: 10 }
      const roomB: MapRoom = { id: 'B', x: 1000, y: 0, width: 1000, height: 1000, cellX: 10, cellY: 0, cellsX: 10, cellsY: 10 }
      const rooms = [roomA, roomB]

      // Rakanishu fixed at world pixel coordinates (1500, 500) inside room B
      const rakanishuPack = pack('rakanishu', 4, {
        superUniqueId: 'Rakanishu',
        fixedPosition: { x: 1500, y: 500 },
      })

      const allocation = allocatePacksToRooms([rakanishuPack], rooms)
      expect(allocation.get(roomB)).toContain(rakanishuPack)
      expect(allocation.get(roomA)).toHaveLength(0)
    })

    it('is deterministic with a given seed', () => {
      const rooms: MapRoom[] = [
        { id: 1, x: 0, y: 0, width: 800, height: 800, cellX: 0, cellY: 0, cellsX: 10, cellsY: 10 },
        { id: 2, x: 800, y: 0, width: 800, height: 800, cellX: 10, cellY: 0, cellsX: 10, cellsY: 10 },
        { id: 3, x: 1600, y: 0, width: 800, height: 800, cellX: 20, cellY: 0, cellsX: 10, cellsY: 10 },
      ]
      const packs = Array.from({ length: 9 }, (_, i) => pack(`mob_${String(i)}`, 2))

      const run1 = allocatePacksToRooms(packs, rooms, 9999)
      const run2 = allocatePacksToRooms(packs, rooms, 9999)

      for (const room of rooms) {
        const p1 = run1.get(room)!.map(p => p.members[0]?.id)
        const p2 = run2.get(room)!.map(p => p.members[0]?.id)
        expect(p1).toEqual(p2)
      }
    })
  })

  describe('spawnPacksInRoom', () => {
    it('places monster pack strictly within room boundaries', () => {
      const world = createWorld(0, 0)
      const room: MapRoom = {
        id: 'test_room',
        x: 1000,
        y: 1000,
        width: 400,
        height: 400,
        cellX: 10,
        cellY: 10,
        cellsX: 5,
        cellsY: 5,
      }
      const testPack = pack('fallen', 6)

      const placed = spawnPacksInRoom(world, testPack, room, OPEN)
      expect(placed).toBe(6)
      expect(world.monsters).toHaveLength(6)

      // Verify every monster is strictly inside room bounds
      for (const monster of world.monsters) {
        expect(monster.x).toBeGreaterThanOrEqual(room.x)
        expect(monster.x).toBeLessThanOrEqual(room.x + room.width)
        expect(monster.y).toBeGreaterThanOrEqual(room.y)
        expect(monster.y).toBeLessThanOrEqual(room.y + room.height)
      }
    })

    it('respects terrain collisions and does not spill through walls', () => {
      const world = createWorld(0, 0)
      const room: MapRoom = {
        id: 'walled_room',
        x: 500,
        y: 500,
        width: 400,
        height: 400,
        cellX: 5,
        cellY: 5,
        cellsX: 5,
        cellsY: 5,
      }
      // Vertical solid wall slicing through x in [680, 750]
      const walledTerrain: CombatTerrain = {
        overlap: (x: number) => (x >= 680 && x <= 750 ? 1 : 0),
      }
      const testPack = pack('zombie', 8)

      const placed = spawnPacksInRoom(world, testPack, room, walledTerrain)
      expect(placed).toBeGreaterThan(0)

      for (const monster of world.monsters) {
        // Must never land on solid wall
        expect(walledTerrain.overlap(monster.x, monster.y)).toBe(0)
        expect(monster.x < 680 || monster.x > 750).toBe(true)
        // Must stay inside room
        expect(monster.x).toBeGreaterThanOrEqual(room.x)
        expect(monster.x).toBeLessThanOrEqual(room.x + room.width)
        expect(monster.y).toBeGreaterThanOrEqual(room.y)
        expect(monster.y).toBeLessThanOrEqual(room.y + room.height)
      }
    })

    it('clusters minions tightly around leader within PACK_RADIUS_PX', () => {
      const world = createWorld(0, 0)
      const room: MapRoom = {
        id: 'cluster_room',
        x: 2000,
        y: 2000,
        width: 800,
        height: 800,
        cellX: 20,
        cellY: 20,
        cellsX: 10,
        cellsY: 10,
      }
      const testPack = pack('fallen', 7)

      spawnPacksInRoom(world, testPack, room, OPEN)
      expect(world.monsters).toHaveLength(7)

      const leader = world.monsters[0]!
      const minions = world.monsters.slice(1)

      for (const minion of minions) {
        const dist = Math.hypot(minion.x - leader.x, minion.y - leader.y)
        expect(dist).toBeLessThanOrEqual(PACK_RADIUS_PX)
      }
    })

    it('positions leader near interior center of room on clear ground', () => {
      const world = createWorld(0, 0)
      const room: MapRoom = {
        id: 'center_test',
        x: 1000,
        y: 1000,
        width: 400,
        height: 400,
        cellX: 10,
        cellY: 10,
        cellsX: 5,
        cellsY: 5,
      }
      const testPack = pack('boss', 1)

      spawnPacksInRoom(world, testPack, room, OPEN)
      expect(world.monsters).toHaveLength(1)

      const leader = world.monsters[0]!
      const roomCenterX = room.x + room.width / 2 // 1200
      const roomCenterY = room.y + room.height / 2 // 1200

      // Leader should land right at or very close to center
      expect(Math.abs(leader.x - roomCenterX)).toBeLessThan(16)
      expect(Math.abs(leader.y - roomCenterY)).toBeLessThan(16)
    })

    it('places fixedPosition SuperUnique at or near designated landmark coordinates', () => {
      const world = createWorld(0, 0)
      const room: MapRoom = {
        id: 'landmark_room',
        x: 0,
        y: 0,
        width: 1000,
        height: 1000,
        cellX: 0,
        cellY: 0,
        cellsX: 10,
        cellsY: 10,
      }
      const testPack = pack('treehead', 1, {
        superUniqueId: 'Treehead WoodFist',
        fixedPosition: { x: 350, y: 450 },
      })

      spawnPacksInRoom(world, testPack, room, OPEN)
      expect(world.monsters).toHaveLength(1)

      const leader = world.monsters[0]!
      expect(leader.x).toBe(350)
      expect(leader.y).toBe(450)
    })
  })

  describe('spawnMonsterPacksByRooms', () => {
    it('populates world with all packs distributed across partitioned rooms', () => {
      const world = createWorld(0, 0)
      const rooms = partitionMapIntoRooms(48, 48, { roomCellSize: 24, cellPixelSize: 80 })
      const packs = [
        pack('fallen', 4),
        pack('zombie', 3),
        pack('skeleton', 5),
      ]

      const placed = spawnMonsterPacksByRooms(world, packs, rooms, OPEN, { seed: 101 })
      expect(placed).toBe(12)
      expect(world.monsters).toHaveLength(12)

      // Verify every monster lies within at least one room's bounding box
      for (const m of world.monsters) {
        const inAnyRoom = rooms.some(
          r => m.x >= r.x && m.x <= r.x + r.width && m.y >= r.y && m.y <= r.y + r.height,
        )
        expect(inAnyRoom).toBe(true)
      }
    })

    it('maintains backwards compatibility when fallback around coordinates are passed', () => {
      const world = createWorld(0, 0)
      const packs = [pack('fallen', 3)]

      const placed = spawnMonsterPacksByRooms(
        world,
        packs,
        { x: 500, y: 500 },
        OPEN,
        { spread: 300 },
      )
      expect(placed).toBe(3)
      expect(world.monsters).toHaveLength(3)
    })
  })
})
