/**
 * Issue #1349 — 1.13c waypoint unlock and `0x49 WaypointGo` validation:
 * only the operated waypoint unlocks, destination must be activated/valid/act-open,
 * and the player must still stand at the waypoint object.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

function connect(game: GameInstance, x = 50, y = 50): number {
  return game.connectPlayer({ charClass: 'sor', name: 'Wp', x, y, areaId: 1 })
}

function playerRecord(game: GameInstance, id: number): {
  x: number
  y: number
  areaId: number
  waypoints: Set<number>
  unlockedAct: number
} {
  return (game as unknown as {
    players: Map<number, { x: number; y: number; areaId: number; waypoints: Set<number>; unlockedAct: number }>
  }).players.get(id)!
}

function openWaypoint(game: GameInstance, id: number): number {
  const p = playerRecord(game, id)
  const wpId = game.spawnObject({
    classId: 119,
    x: p.x,
    y: p.y,
    areaId: p.areaId,
    isWaypoint: true,
  })
  game.enqueueCommand(id, { type: 'OperateObject', objectId: wpId })
  game.stepFrames(1)
  game.drainEvents(id)
  return wpId
}

describe('issue #1349 waypoint gating', () => {
  it('walking into a waypoint level does not unlock it; operating it does', () => {
    const game = new GameInstance({ seed: 1349, areaId: 1 })
    const playerId = connect(game)
    const record = playerRecord(game, playerId)
    ;(game as unknown as {
      transitionPlayerArea: (p: unknown, area: number, arrival: { kind: string }) => void
    }).transitionPlayerArea(record, 3, { kind: 'warp' })
    expect(record.areaId).toBe(3)
    expect(record.waypoints.has(3)).toBe(false)

    openWaypoint(game, playerId)
    expect(record.waypoints.has(3)).toBe(true)
  })

  it('rejects a forged 0x49 without an operated waypoint, with an invalid destination, or far away', () => {
    const game = new GameInstance({ seed: 1350, areaId: 1 })
    const playerId = connect(game)
    const record = playerRecord(game, playerId)
    record.waypoints.add(3)

    // No waypoint menu has been opened.
    game.enqueueCommand(playerId, { type: 'WaypointGo', waypointId: 1, destAreaId: 3 })
    game.stepFrames(1)
    expect(record.areaId).toBe(1)

    // Destination is not one of the 39 waypoint levels.
    openWaypoint(game, playerId)
    record.waypoints.add(2)
    game.enqueueCommand(playerId, { type: 'WaypointGo', waypointId: 1, destAreaId: 2 })
    game.stepFrames(1)
    expect(record.areaId).toBe(1)

    // Player walked away from the operated waypoint: clears activeWaypointUnitId and does not auto-approach.
    openWaypoint(game, playerId)
    record.x = 80
    record.y = 80
    game.enqueueCommand(playerId, { type: 'WaypointGo', waypointId: 1, destAreaId: 3 })
    game.stepFrames(20)
    expect(record.areaId).toBe(1)

    // Standing next to an unopened waypoint also rejects a forged 0x49 across multiple frames.
    const unopenedWpId = game.spawnObject({
      classId: 119,
      x: Math.round(record.x),
      y: Math.round(record.y),
      areaId: 1,
      isWaypoint: true,
    })
    game.enqueueCommand(playerId, { type: 'WaypointGo', waypointId: unopenedWpId, destAreaId: 3 })
    game.stepFrames(20)
    expect(record.areaId).toBe(1)
  })

  it('0x49 with destAreaId=0 or current areaId closes the active waypoint session (D2Game 0x6fc8e9c8)', () => {
    const game = new GameInstance({ seed: 1353, areaId: 1 })
    const playerId = connect(game)
    const record = playerRecord(game, playerId)
    record.waypoints.add(3)

    const wpId = openWaypoint(game, playerId)
    game.enqueueCommand(playerId, { type: 'WaypointGo', waypointId: wpId, destAreaId: 0 })
    game.stepFrames(1)
    expect(record.areaId).toBe(1)
    // Subsequent 0x49 without re-operating the waypoint must be rejected.
    game.enqueueCommand(playerId, { type: 'WaypointGo', waypointId: wpId, destAreaId: 3 })
    game.stepFrames(1)
    expect(record.areaId).toBe(1)
  })

  it('exportPlayerD2s persists only operated waypoints in the WS block', () => {
    const game = new GameInstance({ seed: 1354, areaId: 1 })
    const playerId = connect(game)
    const record = playerRecord(game, playerId)
    ;(game as unknown as {
      transitionPlayerArea: (p: unknown, area: number, arrival: { kind: string }) => void
    }).transitionPlayerArea(record, 3, { kind: 'warp' })
    expect(record.areaId).toBe(3)

    const d2sBefore = game.exportPlayerD2s(playerId)!
    const gameCheck1 = new GameInstance({ seed: 1355, areaId: 1 })
    const pid1 = gameCheck1.connectPlayer({ d2s: d2sBefore })
    expect(playerRecord(gameCheck1, pid1).waypoints.has(3)).toBe(false)

    openWaypoint(game, playerId)
    const d2sAfter = game.exportPlayerD2s(playerId)!
    const gameCheck2 = new GameInstance({ seed: 1356, areaId: 1 })
    const pid2 = gameCheck2.connectPlayer({ d2s: d2sAfter })
    expect(playerRecord(gameCheck2, pid2).waypoints.has(3)).toBe(true)
  })

  it('accepts an activated in-act destination from the operated waypoint', () => {
    const game = new GameInstance({ seed: 1351, areaId: 1 })
    const playerId = connect(game)
    const record = playerRecord(game, playerId)
    record.waypoints.add(3)
    openWaypoint(game, playerId)
    game.enqueueCommand(playerId, { type: 'WaypointGo', waypointId: 1, destAreaId: 3 })
    game.stepFrames(1)
    expect(record.areaId).toBe(3)
  })

  it('requires the destination act to be unlocked', () => {
    const game = new GameInstance({ seed: 1352, areaId: 1 })
    const playerId = connect(game)
    const record = playerRecord(game, playerId)
    record.waypoints.add(40) // Act 2 Lut Gholein bit, but Act 2 was never reached
    openWaypoint(game, playerId)
    game.enqueueCommand(playerId, { type: 'WaypointGo', waypointId: 9, destAreaId: 40 })
    game.stepFrames(1)
    expect(record.areaId).toBe(1)

    record.unlockedAct = 1
    openWaypoint(game, playerId)
    game.enqueueCommand(playerId, { type: 'WaypointGo', waypointId: 9, destAreaId: 40 })
    game.stepFrames(1)
    expect(record.areaId).toBe(40)
  })
})