import { describe, expect, it, vi } from 'vitest'
import { createWorld, damageMonster, tickCombat } from '../src/server/ai/monster-ai.ts'
import type { CombatOptions, CombatTerrain, MonsterPack, MonsterStats } from '../src/server/ai/monster-ai.ts'
import { GameEngine } from '../src/server/engine/game-engine.ts'
import type { GameEngineOptions, WorldMapProvider } from '../src/server/engine/game-engine.ts'
import { MonsterStreamingManager, distanceToRoom } from '../src/common/units/monster-streaming.ts'
import type { StreamingRoomDef, StreamingRoomState } from '../src/common/units/monster-streaming.ts'

/** Open ground everywhere. */
const OPEN: CombatTerrain = { overlap: () => 0 }

/** Minimal map provider for engine testing. */
const OPEN_MAP: WorldMapProvider = {
  widthPx: 10000,
  heightPx: 10000,
  overlap: () => 0,
}

/** Helper to construct test monster stats. */
function stats(id: string, hp = 30, damage = 5): MonsterStats {
  return {
    id,
    name: id,
    hp,
    damage,
    cooldownTicks: 25,
    reach: 40,
    aggroRadius: 200,
    speed: 100,
    xp: 10,
  }
}

/** Helper to construct a test monster pack. */
function pack(id: string, count: number, hp = 30): MonsterPack {
  return {
    members: Array.from({ length: count }, (_, i) => stats(id, hp + i)),
  }
}

/** Default combat options for simulation. */
const DEFAULT_COMBAT_OPTIONS: CombatOptions = {
  playerSpeed: 100,
  playerReach: 40,
  playerCooldownTicks: 25,
  playerDamage: 10,
  playerManaPerAttack: 0,
  respawnTicks: 100,
}

describe('distanceToRoom', () => {
  const bounds = { minX: 1000, minY: 1000, maxX: 2000, maxY: 2000 }

  it('returns 0 when point is inside room bounds', () => {
    expect(distanceToRoom(1500, 1500, bounds)).toBe(0)
    expect(distanceToRoom(1000, 1000, bounds)).toBe(0)
    expect(distanceToRoom(2000, 2000, bounds)).toBe(0)
  })

  it('calculates orthogonal distance correctly', () => {
    expect(distanceToRoom(500, 1500, bounds)).toBe(500)
    expect(distanceToRoom(2600, 1500, bounds)).toBe(600)
    expect(distanceToRoom(1500, 300, bounds)).toBe(700)
    expect(distanceToRoom(1500, 2800, bounds)).toBe(800)
  })

  it('calculates diagonal distance to closest corner', () => {
    // Distance from (700, 600) to (1000, 1000) is hypot(300, 400) = 500
    expect(distanceToRoom(700, 600, bounds)).toBe(500)
  })
})

describe('MonsterStreamingManager - Lazy Population (bPopulated)', () => {
  it('populates only spawn neighborhood rooms on initialization, leaving distant rooms unpopulated', () => {
    const world = createWorld(100, 100)
    const rooms: StreamingRoomDef[] = [
      {
        id: 'spawn_room',
        bounds: { minX: 0, minY: 0, maxX: 400, maxY: 400 },
        packs: [pack('fallen1', 3)],
      },
      {
        id: 'adjacent_room',
        bounds: { minX: 600, minY: 0, maxX: 1000, maxY: 400 }, // distance = 500 <= 1600
        packs: [pack('zombie1', 2)],
      },
      {
        id: 'distant_room_1',
        bounds: { minX: 3000, minY: 3000, maxX: 3500, maxY: 3500 }, // distance ~4100 > 1600
        packs: [pack('quillrat1', 4)],
      },
      {
        id: 'distant_room_2',
        bounds: { minX: 6000, minY: 6000, maxX: 6500, maxY: 6500 }, // distance ~8300 > 1600
        packs: [pack('skeleton1', 3)],
      },
    ]

    const mgr = new MonsterStreamingManager(world, OPEN, rooms, {
      activationRadius: 1600,
      deactivationRadius: 2400,
    })

    // Only spawn_room (3) and adjacent_room (2) are populated
    expect(world.monsters).toHaveLength(5)

    const [spawnRoom, adjRoom, distRoom1, distRoom2] = mgr.rooms as [
      StreamingRoomState,
      StreamingRoomState,
      StreamingRoomState,
      StreamingRoomState,
    ]

    expect(spawnRoom.bPopulated).toBe(true)
    expect(spawnRoom.active).toBe(true)
    expect(spawnRoom.monsterIndices).toEqual([0, 1, 2])

    expect(adjRoom.bPopulated).toBe(true)
    expect(adjRoom.active).toBe(true)
    expect(adjRoom.monsterIndices).toEqual([3, 4])

    // Distant rooms must NOT be populated and must have 0 monster indices
    expect(distRoom1.bPopulated).toBe(false)
    expect(distRoom1.active).toBe(false)
    expect(distRoom1.monsterIndices).toHaveLength(0)

    expect(distRoom2.bPopulated).toBe(false)
    expect(distRoom2.active).toBe(false)
    expect(distRoom2.monsterIndices).toHaveLength(0)

    // Active monsters are awake
    expect(world.monsters.every(m => !m.sleeping)).toBe(true)
  })

  it('triggers room activation and population when player approaches', () => {
    const world = createWorld(100, 100)
    const rooms: StreamingRoomDef[] = [
      {
        id: 'spawn_room',
        bounds: { minX: 0, minY: 0, maxX: 400, maxY: 400 },
        packs: [pack('fallen1', 2)],
      },
      {
        id: 'distant_room',
        bounds: { minX: 3000, minY: 3000, maxX: 3500, maxY: 3500 },
        packs: [pack('zombie1', 3)],
      },
    ]

    const mgr = new MonsterStreamingManager(world, OPEN, rooms, {
      activationRadius: 1600,
      deactivationRadius: 2400,
    })

    expect(world.monsters).toHaveLength(2)
    expect(mgr.rooms[1]!.bPopulated).toBe(false)

    // Move player close to distant room (distance to [3000, 3000] is ~282px <= 1600)
    world.player.x = 2800
    world.player.y = 2800
    mgr.update(world.player.x, world.player.y)

    const distantRoom = mgr.rooms[1]!
    expect(distantRoom.bPopulated).toBe(true)
    expect(distantRoom.active).toBe(true)
    expect(distantRoom.monsterIndices).toEqual([2, 3, 4])
    expect(world.monsters).toHaveLength(5)

    // Distant monsters are active and not sleeping
    for (const idx of distantRoom.monsterIndices) {
      expect(world.monsters[idx]!.sleeping).toBe(false)
    }
  })

  it('invokes onSpawnRoom callback exactly once when a room is populated', () => {
    const world = createWorld(100, 100)
    const onSpawnRoom = vi.fn()
    const rooms: StreamingRoomDef[] = [
      {
        id: 'room_a',
        bounds: { minX: 0, minY: 0, maxX: 300, maxY: 300 },
        packs: [pack('fallen1', 2)],
      },
      {
        id: 'room_b',
        bounds: { minX: 3000, minY: 3000, maxX: 3300, maxY: 3300 },
        packs: [pack('zombie1', 2)],
      },
    ]

    const mgr = new MonsterStreamingManager(world, OPEN, rooms, {
      activationRadius: 1600,
      deactivationRadius: 2400,
      onSpawnRoom,
    })

    // room_a spawned on init
    expect(onSpawnRoom).toHaveBeenCalledTimes(1)
    expect(onSpawnRoom).toHaveBeenCalledWith(expect.objectContaining({ id: 'room_a', bPopulated: true }))

    // Move closer to room_b
    mgr.update(3000, 3000)
    expect(onSpawnRoom).toHaveBeenCalledTimes(2)
    expect(onSpawnRoom).toHaveBeenCalledWith(expect.objectContaining({ id: 'room_b', bPopulated: true }))

    // Repeated updates do NOT trigger onSpawnRoom again
    mgr.update(3000, 3000)
    mgr.update(0, 0)
    mgr.update(3000, 3000)
    expect(onSpawnRoom).toHaveBeenCalledTimes(2)
  })
})

describe('MonsterStreamingManager - Active / Sleeping Room Streaming', () => {
  it('marks living monsters in distant rooms as sleeping and skips their AI in tickMonsters', () => {
    const world = createWorld(100, 100)
    const rooms: StreamingRoomDef[] = [
      {
        id: 'room_spawn',
        bounds: { minX: 0, minY: 0, maxX: 300, maxY: 300 },
        packs: [pack('fallen1', 2)],
      },
      {
        id: 'room_far',
        bounds: { minX: 3000, minY: 3000, maxX: 3300, maxY: 3300 },
        packs: [pack('zombie1', 2)],
      },
    ]

    const mgr = new MonsterStreamingManager(world, OPEN, rooms, {
      activationRadius: 1600,
      deactivationRadius: 2400,
    })

    // Populate room_far
    mgr.update(3100, 3100)
    expect(mgr.rooms[0]!.active).toBe(false)
    expect(mgr.rooms[1]!.active).toBe(true)

    // Monsters in room_spawn (indices 0, 1) are now sleeping
    const sleepingMonster = world.monsters[0]!
    expect(sleepingMonster.sleeping).toBe(true)

    // Set cooldown and hitFlash on sleeping monster to verify tickMonsters skips it completely
    sleepingMonster.cooldown = 15
    sleepingMonster.hitFlash = 3
    const initialMonsterX = sleepingMonster.x
    const initialMonsterY = sleepingMonster.y

    // Advance simulation tick: sleeping monster must skip all AI and timers
    tickCombat(
      world,
      { movement: { x: 0, y: 0 }, attack: false },
      DEFAULT_COMBAT_OPTIONS,
      OPEN,
      [0, 100, 200],
    )

    expect(sleepingMonster.cooldown).toBe(15) // Cooldown preserved without decrementing
    expect(sleepingMonster.hitFlash).toBe(3) // hitFlash preserved without decrementing
    expect(sleepingMonster.x).toBe(initialMonsterX)
    expect(sleepingMonster.y).toBe(initialMonsterY)

    // Active monsters in room_far (e.g. index 2) are not sleeping
    const activeMonster = world.monsters[2]!
    expect(activeMonster.sleeping).toBe(false)
  })

  it('wakes sleeping monsters when player re-enters activationRadius', () => {
    const world = createWorld(100, 100)
    const rooms: StreamingRoomDef[] = [
      {
        id: 'room_spawn',
        bounds: { minX: 0, minY: 0, maxX: 300, maxY: 300 },
        packs: [pack('fallen1', 2)],
      },
      {
        id: 'room_far',
        bounds: { minX: 3000, minY: 3000, maxX: 3300, maxY: 3300 },
        packs: [pack('zombie1', 2)],
      },
    ]

    const mgr = new MonsterStreamingManager(world, OPEN, rooms, {
      activationRadius: 1600,
      deactivationRadius: 2400,
    })

    // Move player far away: room_spawn deactivates
    mgr.update(4000, 4000)
    expect(mgr.rooms[0]!.active).toBe(false)
    expect(world.monsters[0]!.sleeping).toBe(true)

    // Move player back: room_spawn wakes up
    mgr.update(100, 100)
    expect(mgr.rooms[0]!.active).toBe(true)
    expect(world.monsters[0]!.sleeping).toBe(false)
    expect(world.monsters[1]!.sleeping).toBe(false)
  })

  it('preserves monster damage, cooldowns, and positions across sleeping and wake cycles', () => {
    const world = createWorld(100, 100)
    const rooms: StreamingRoomDef[] = [
      {
        id: 'room_spawn',
        bounds: { minX: 0, minY: 0, maxX: 300, maxY: 300 },
        packs: [pack('fallen1', 2, 50)],
      },
    ]

    const mgr = new MonsterStreamingManager(world, OPEN, rooms, {
      activationRadius: 1600,
      deactivationRadius: 2400,
    })

    const target = world.monsters[0]!
    const initialHp = target.hp
    damageMonster(world, 0, 18) // HP becomes initialHp - 18
    target.cooldown = 14
    const preservedX = target.x
    const preservedY = target.y

    // Deactivate room
    mgr.update(4000, 4000)
    expect(mgr.rooms[0]!.active).toBe(false)
    expect(target.sleeping).toBe(true)

    // Simulate several ticks while monster is sleeping
    for (let i = 0; i < 5; i += 1) {
      tickCombat(
        world,
        { movement: { x: 0, y: 0 }, attack: false },
        DEFAULT_COMBAT_OPTIONS,
        OPEN,
        [0, 100, 200],
      )
    }

    // Wake room back up
    mgr.update(100, 100)
    expect(mgr.rooms[0]!.active).toBe(true)
    expect(target.sleeping).toBe(false)
    expect(target.hp).toBe(initialHp - 18)
    expect(target.cooldown).toBe(14)
    expect(target.x).toBe(preservedX)
    expect(target.y).toBe(preservedY)
  })

  it('respects hysteresis between activationRadius and deactivationRadius', () => {
    const world = createWorld(100, 100)
    const rooms: StreamingRoomDef[] = [
      {
        id: 'room_spawn',
        bounds: { minX: 0, minY: 0, maxX: 300, maxY: 300 },
        packs: [pack('fallen1', 1)],
      },
      {
        id: 'room_mid',
        bounds: { minX: 2000, minY: 0, maxX: 2200, maxY: 300 }, // distance from (100, 100) is 1900
        packs: [pack('zombie1', 1)],
      },
    ]

    const mgr = new MonsterStreamingManager(world, OPEN, rooms, {
      activationRadius: 1600,
      deactivationRadius: 2400,
    })

    const roomSpawn = mgr.rooms[0]!
    const roomMid = mgr.rooms[1]!

    // Initial state: player at 100, 100
    // roomSpawn is active (dist = 0 <= 1600)
    // roomMid is at dist 1900 (between 1600 and 2400), so it stays unpopulated & inactive
    expect(roomSpawn.active).toBe(true)
    expect(roomMid.bPopulated).toBe(false)
    expect(roomMid.active).toBe(false)

    // Player moves to dist 2000 from roomSpawn:
    // roomSpawn was already active, so it STAYS active (dist 2000 <= 2400)
    mgr.update(2100, 100)
    // Now player is inside roomMid! (x: 2100 is between 2000 and 2200)
    expect(roomMid.bPopulated).toBe(true)
    expect(roomMid.active).toBe(true)
    // roomSpawn distance is 2100 - 300 = 1800 <= 2400, so it remains active
    expect(roomSpawn.active).toBe(true)

    // Player moves farther to x: 2800 (distance from roomSpawn: 2500 > 2400)
    mgr.update(2800, 100)
    expect(roomSpawn.active).toBe(false)

    // Player steps back to x: 2300 (distance from roomSpawn: 2000, between 1600 and 2400)
    // roomSpawn was sleeping, so it STAYS sleeping until <= 1600!
    mgr.update(2300, 100)
    expect(roomSpawn.active).toBe(false)

    // Player steps closer to x: 1800 (distance from roomSpawn: 1500 <= 1600)
    // roomSpawn wakes up!
    mgr.update(1800, 100)
    expect(roomSpawn.active).toBe(true)
  })
})

describe('MonsterStreamingManager - Idempotency & Non-Respawn', () => {
  it('never re-populates a room once bPopulated is true: dead monsters stay dead when returning', () => {
    const world = createWorld(100, 100)
    const rooms: StreamingRoomDef[] = [
      {
        id: 'room_a',
        bounds: { minX: 0, minY: 0, maxX: 400, maxY: 400 },
        packs: [pack('fallen1', 3)],
      },
      {
        id: 'room_b',
        bounds: { minX: 3000, minY: 3000, maxX: 3400, maxY: 3400 },
        packs: [pack('zombie1', 3)],
      },
    ]

    const mgr = new MonsterStreamingManager(world, OPEN, rooms, {
      activationRadius: 1600,
      deactivationRadius: 2400,
    })

    expect(world.monsters).toHaveLength(3)

    // Approach room_b to populate it
    mgr.update(3200, 3200)
    expect(world.monsters).toHaveLength(6)
    const roomB = mgr.rooms[1]!
    expect(roomB.bPopulated).toBe(true)

    // Kill all monsters in room_b
    for (const idx of roomB.monsterIndices) {
      damageMonster(world, idx, 9999)
      expect(world.monsters[idx]!.state).toBe('dead')
    }

    const totalMonstersBeforeLeave = world.monsters.length
    expect(totalMonstersBeforeLeave).toBe(6)

    // Player leaves room_b far away
    mgr.update(100, 100)
    expect(roomB.active).toBe(false)

    // Player returns to room_b
    mgr.update(3200, 3200)
    expect(roomB.active).toBe(true)
    expect(roomB.bPopulated).toBe(true)

    // Verification: NO new monsters are spawned
    expect(world.monsters).toHaveLength(totalMonstersBeforeLeave)
    for (const idx of roomB.monsterIndices) {
      expect(world.monsters[idx]!.state).toBe('dead')
    }
  })
})

describe('GameEngine Integration with MonsterStreamingManager', () => {
  const dummyOpts: GameEngineOptions = {
    spawn: { x: 100, y: 100 },
    stats: [stats('fallen1'), stats('zombie1')],
    xpTable: [0, 0, 10, 30, 60],
    itemBases: [],
    prefixAffixes: [],
    suffixAffixes: [],
    skills: [],
    npcDefs: [],
    questDefs: [],
    combatOptions: DEFAULT_COMBAT_OPTIONS,
    talkRadius: 50,
    pickupRadius: 50,
    inventoryCols: 10,
    inventoryRows: 4,
    monsterCount: 0,
  }

  it('automatically initializes MonsterStreamingManager when roomPacks are provided', () => {
    const rooms: StreamingRoomDef[] = [
      {
        id: 'spawn_room',
        bounds: { minX: 0, minY: 0, maxX: 500, maxY: 500 },
        packs: [pack('fallen1', 2)],
      },
      {
        id: 'distant_room',
        bounds: { minX: 3000, minY: 3000, maxX: 3500, maxY: 3500 },
        packs: [pack('zombie1', 3)],
      },
    ]

    const engine = new GameEngine(OPEN_MAP, {
      ...dummyOpts,
      roomPacks: rooms,
    })

    expect(engine.streamingManager).toBeDefined()
    expect(engine.streamingManager?.rooms).toHaveLength(2)
    // Only spawn room monsters are created initially
    expect(engine.world.monsters).toHaveLength(2)
    expect(engine.streamingManager?.rooms[0]!.bPopulated).toBe(true)
    expect(engine.streamingManager?.rooms[1]!.bPopulated).toBe(false)
  })

  it('calls streamingManager.update in GameEngine.tick to stream rooms as player moves', () => {
    const rooms: StreamingRoomDef[] = [
      {
        id: 'spawn_room',
        bounds: { minX: 0, minY: 0, maxX: 500, maxY: 500 },
        packs: [pack('fallen1', 2)],
      },
      {
        id: 'distant_room',
        bounds: { minX: 1200, minY: 100, maxX: 1500, maxY: 500 }, // distance ~700 from (500, 100)
        packs: [pack('zombie1', 3)],
      },
    ]

    const engine = new GameEngine(OPEN_MAP, {
      ...dummyOpts,
      roomPacks: rooms,
      streamingOptions: {
        activationRadius: 800,
        deactivationRadius: 1400,
      },
    })

    // Initially at (100, 100), distance to distant_room is 1100 > 800 -> unpopulated
    expect(engine.world.monsters).toHaveLength(2)
    expect(engine.streamingManager?.rooms[1]!.bPopulated).toBe(false)

    // Teleport player closer to distant room
    engine.world.player.x = 800
    engine.world.player.y = 100

    // Next engine.tick should update streaming manager and populate distant room
    engine.tick({
      movement: { x: 0, y: 0 },
      attacking: false,
      pickingUp: false,
      talking: false,
      digits: [],
      saving: false,
      loading: false,
    })

    expect(engine.streamingManager?.rooms[1]!.bPopulated).toBe(true)
    expect(engine.world.monsters).toHaveLength(5)
  })

  it('accepts pre-constructed streamingManager in GameEngineOptions', () => {
    const world = createWorld(100, 100)
    const rooms: StreamingRoomDef[] = [
      {
        id: 'room_1',
        bounds: { minX: 0, minY: 0, maxX: 500, maxY: 500 },
        packs: [pack('fallen1', 2)],
      },
    ]
    const streamingManager = new MonsterStreamingManager(world, OPEN, rooms)

    const engine = new GameEngine(OPEN_MAP, {
      ...dummyOpts,
      streamingManager,
    })

    expect(engine.streamingManager).toBe(streamingManager)
    expect(engine.world).toBe(world)
    expect(engine.world.monsters).toHaveLength(2)
  })
})
