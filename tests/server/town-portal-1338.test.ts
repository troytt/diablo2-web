/**
 * Issue #1338 — both Town Portal mouths (wilderness caster point + fixed town tile),
 * linked ownership, two-way travel, and town-entry closure.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { createAreaBootstrapResolver } from '../../src/server/world/area-bootstrap.ts'
import type { LocalAreaLevelGeometry, LocalAreaLevelSource } from '../../src/netproto/index.ts'

function level(areaId: number, ox: number, oy: number, size: number): LocalAreaLevelGeometry {
  return {
    areaId,
    originX: ox,
    originY: oy,
    subWidth: size,
    subHeight: size,
    blocked: new Uint8Array(size * size),
    spawnTileX: 2,
    spawnTileY: 2,
    rooms: [{ areaId, tileX: ox / 5, tileY: oy / 5 }],
    roomRects: [{ index: 0, x: ox, y: oy, w: size, h: size, seed: 1 }],
    adjacentAreaIds: [],
    presetUnits: [],
    warps: [],
    // #1698: the town carries the DUNGEON_FindActSpawnLocationEx capture; its style-33 marker
    // (tile index 11) sits at level-local tile (10, 11) -> sub-tile (10*5+3, 11*5+3) = (53, 58).
    ...(areaId === 1
      ? {
          actSpawn: {
            level: {
              position: 1,
              tileInfo: [{ x: 4, y: 4, index: 0 }, { x: 10, y: 11, index: 11 }],
              rooms: [{ x: 0, y: 0, w: size / 5, h: size / 5 }],
              waypointRoom: -1,
              waypointTile: null,
              warpRoom: -1,
              centreX: size / 10 - 2,
              centreY: size / 10 - 2,
            },
            seed: [1338, 666] as const,
          },
        }
      : {}),
  }
}

function makeGame(): GameInstance {
  const source: LocalAreaLevelSource = request => {
    if (request.areaId === 1) return level(1, 100, 100, 100)
    if (request.areaId === 2) return level(2, 1000, 1000, 60)
    return null
  }
  return new GameInstance({
    seed: 1338,
    difficulty: 0,
    areaId: 2,
    resolveAreaBootstrap: createAreaBootstrapResolver(source),
  })
}

interface ObjectRecord {
  unitId: number
  areaId: number
  x: number
  y: number
  classId: number
  destAreaId?: number
  portalOwnerId?: number
}

function ownedPortals(game: GameInstance, ownerId: number): ObjectRecord[] {
  const objects = (game as unknown as { objects: Map<number, ObjectRecord> }).objects
  return [...objects.values()].filter(o => o.portalOwnerId === ownerId)
}

describe('issue #1338: two-ended town portal', () => {
  it('spawns both mouths, travels to the paired mouth, and closes after returning', () => {
    const game = makeGame()
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'PortalUser', x: 1030, y: 1030, areaId: 2 })
    const player = (game as unknown as { players: Map<number, { items: unknown[] }> }).players.get(playerId)!
    player.items.push({
      unitId: 9001,
      code: 'tsc',
      location: 'inventory',
      x: 0,
      y: 0,
      quantity: 1,
      stats: new Map(),
      socketedItems: [],
    })
    game.drainEvents(playerId)

    game.enqueueCommand(playerId, { type: 'TownPortal' })
    game.stepFrame()

    const portals = ownedPortals(game, playerId)
    expect(portals).toHaveLength(2)
    const townMouth = portals.find(p => p.areaId === 1)!
    const wildMouth = portals.find(p => p.areaId === 2)!
    expect(townMouth).toBeDefined()
    expect(wildMouth).toBeDefined()
    expect(townMouth.destAreaId).toBe(2)
    expect(wildMouth.destAreaId).toBe(1)
    // Town mouth = origin (100, 100) + style-33 marker tile (10, 11) * 5 + 3 (#1698).
    expect({ x: townMouth.x, y: townMouth.y }).toEqual({ x: 153, y: 158 })

    game.enqueueCommand(playerId, { type: 'Interact', target: { unitType: 2, id: wildMouth.unitId } })
    game.stepFrame()
    const inTown = game.getPlayerState(playerId)!
    expect(inTown.areaId).toBe(1)
    expect(Math.hypot(inTown.x - townMouth.x, inTown.y - townMouth.y)).toBeLessThanOrEqual(3)
    expect(ownedPortals(game, playerId)).toHaveLength(2)

    game.stepFrames(13) // 500 ms warp/portal click cooldown
    game.enqueueCommand(playerId, { type: 'Interact', target: { unitType: 2, id: townMouth.unitId } })
    game.stepFrame()
    const back = game.getPlayerState(playerId)!
    expect(back.areaId).toBe(2)
    expect(Math.hypot(back.x - wildMouth.x, back.y - wildMouth.y)).toBeLessThanOrEqual(3)
    // Entering from the town mouth closes both ends.
    expect(ownedPortals(game, playerId)).toHaveLength(0)
  })

  it('refuses to open a town portal without a scroll or tome charge', () => {
    const game = makeGame()
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Empty', x: 1030, y: 1030, areaId: 2 })
    game.enqueueCommand(playerId, { type: 'TownPortal' })
    game.stepFrame()
    expect(ownedPortals(game, playerId)).toHaveLength(0)
  })

  it('consumes one tome charge and emits an ItemEvent update', () => {
    const game = makeGame()
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Tome', x: 1030, y: 1030, areaId: 2 })
    const player = (game as unknown as { players: Map<number, { items: any[] }> }).players.get(playerId)!
    const tome = {
      unitId: 9002,
      code: 'tbk',
      location: 'inventory',
      x: 0,
      y: 0,
      quantity: 2,
      stats: new Map(),
      socketedItems: [],
    }
    player.items.push(tome)
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'TownPortal' })
    game.stepFrame()
    expect(tome.quantity).toBe(1)
    expect(ownedPortals(game, playerId)).toHaveLength(2)
    expect(
      game.drainEvents(playerId).some(
        (event) => event.type === 'ItemEvent' && (event as { action?: string }).action === 'update',
      ),
    ).toBe(true)
  })

  it('opens an independent public pair for the Portal Shrine', () => {
    const game = makeGame()
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'ShrineUser', x: 1030, y: 1030, areaId: 2 })
    const player = (game as unknown as { players: Map<number, any> }).players.get(playerId)!
    player.items.push({
      unitId: 9003,
      code: 'tsc',
      location: 'inventory',
      x: 0,
      y: 0,
      quantity: 1,
      stats: new Map(),
      socketedItems: [],
    })
    game.enqueueCommand(playerId, { type: 'TownPortal' })
    game.stepFrame()
    expect(ownedPortals(game, playerId)).toHaveLength(2)
    ;(game as unknown as { applyShrineEffect(p: unknown, code: number, id: number): void }).applyShrineEffect(
      player,
      17,
      777,
    )
    // The player's personal pair survives; the shrine pair uses the public key.
    expect(ownedPortals(game, playerId)).toHaveLength(2)
    expect(ownedPortals(game, -777)).toHaveLength(2)
  })
})