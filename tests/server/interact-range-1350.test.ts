/**
 * Issue #1350 — server-side 1.13c interaction reach checks for objects, warps,
 * NPCs and corpses, plus the 500 ms warp/portal click cooldown.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

function connect(game: GameInstance, x: number, y: number): number {
  return game.connectPlayer({ charClass: 'sor', name: 'Actor', x, y, areaId: 1 })
}

function playerRecord(game: GameInstance, id: number): {
  x: number
  y: number
  areaId: number
  waypoints: Set<number>
  activeNpcId: number | undefined
  corpseId: number | undefined
  corpseX: number
  corpseY: number
} {
  return (game as unknown as {
    players: Map<number, {
      x: number
      y: number
      areaId: number
      waypoints: Set<number>
      activeNpcId: number | undefined
      corpseId: number | undefined
      corpseX: number
      corpseY: number
    }>
  }).players.get(id)!
}

function addWarp(
  game: GameInstance,
  unitId: number,
  areaId: number,
  x: number,
  y: number,
  destAreaId: number,
): void {
  ;(game as unknown as {
    warpTiles: Map<number, {
      unitId: number
      lvlWarpId: number
      areaId: number
      x: number
      y: number
      destAreaId: number
    }>
  }).warpTiles.set(unitId, { unitId, lvlWarpId: 0, areaId, x, y, destAreaId })
}

describe('issue #1350 interaction range', () => {
  it('rejects far object activation and accepts it in range', () => {
    const game = new GameInstance({ seed: 1350, areaId: 1 })
    const playerId = connect(game, 10, 10)
    const record = playerRecord(game, playerId)
    const wpId = game.spawnObject({
      classId: 119,
      x: 50,
      y: 50,
      areaId: 1,
      isWaypoint: true,
    })

    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: wpId })
    game.stepFrames(1)
    expect(record.waypoints.has(1)).toBe(true)
    expect(
      game.drainEvents(playerId).some((e) => e.type === 'WaypointMenu'),
    ).toBe(false)

    record.x = 51
    record.y = 50
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: wpId })
    game.stepFrames(1)
    expect(
      game.drainEvents(playerId).some((e) => e.type === 'WaypointMenu'),
    ).toBe(true)
  })

  it('rejects far warp interaction and enforces the 500 ms cooldown', () => {
    const game = new GameInstance({ seed: 1351, areaId: 1 })
    const playerId = connect(game, 10, 10)
    const record = playerRecord(game, playerId)
    addWarp(game, 9001, 1, 50, 50, 2)
    addWarp(game, 9002, 2, 10, 10, 1)

    game.enqueueCommand(playerId, { type: 'WarpTo', warpId: 9001 })
    game.stepFrames(1)
    expect(record.areaId).toBe(1)

    addWarp(game, 9003, 1, 10, 10, 2)
    game.enqueueCommand(playerId, { type: 'WarpTo', warpId: 9003 })
    game.stepFrames(1)
    expect(record.areaId).toBe(2)

    // Second warp one frame later is inside the 500 ms (13-frame) cooldown.
    game.enqueueCommand(playerId, { type: 'WarpTo', warpId: 9002 })
    game.stepFrames(1)
    expect(record.areaId).toBe(2)

    game.stepFrames(13)
    game.enqueueCommand(playerId, { type: 'WarpTo', warpId: 9002 })
    game.stepFrames(1)
    expect(record.areaId).toBe(1)
  })

  it('rejects far NPC interaction and accepts it in range', () => {
    const game = new GameInstance({ seed: 1352, areaId: 1 })
    const playerId = connect(game, 10, 10)
    const record = playerRecord(game, playerId)
    const npcId = game.spawnMonster({
      defId: 'fallen1',
      x: 50,
      y: 50,
      areaId: 1,
      isNpc: true,
    })

    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: npcId } })
    game.stepFrames(1)
    expect(record.activeNpcId).toBeUndefined()

    record.x = 50
    record.y = 50
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: npcId } })
    game.stepFrames(1)
    expect(record.activeNpcId).toBe(npcId)
  })

  it('rejects far corpse recovery and accepts it within 3 sub-tiles', () => {
    const game = new GameInstance({ seed: 1353, areaId: 1 })
    const playerId = connect(game, 10, 10)
    const record = playerRecord(game, playerId)
    record.corpseId = 777
    record.corpseX = 50
    record.corpseY = 50

    game.enqueueCommand(playerId, { type: 'Interact', target: { unitType: 0, id: 777 } } as never)
    game.stepFrames(1)
    expect(record.corpseId).toBe(777)

    record.x = 51
    record.y = 50
    game.enqueueCommand(playerId, { type: 'Interact', target: { unitType: 0, id: 777 } } as never)
    game.stepFrames(1)
    expect(record.corpseId).toBeUndefined()
  })
})