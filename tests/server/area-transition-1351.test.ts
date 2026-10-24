/**
 * Issue #1351 — 1.13c area transition stream: same-act transitions skip LoadAct,
 * act changes send UnloadAct → LoadAct, rooms use AOI reveal/hide, transition
 * failures roll back, and NPC travel emits CanGoToAct.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { createAreaBootstrapResolver } from '../../src/server/world/area-bootstrap.ts'
import type { LocalAreaLevelGeometry, LocalAreaLevelSource } from '../../src/netproto/index.ts'

function level(
  areaId: number,
  ox: number,
  oy: number,
  rooms: readonly { areaId: number; tileX: number; tileY: number }[],
): LocalAreaLevelGeometry {
  return {
    areaId,
    originX: ox,
    originY: oy,
    subWidth: 200,
    subHeight: 200,
    blocked: new Uint8Array(200 * 200),
    spawnTileX: 4,
    spawnTileY: 4,
    rooms,
    roomRects: [],
    presetUnits: [],
    warps: [],
  }
}

function makeGame(): GameInstance {
  const source: LocalAreaLevelSource = (request) => {
    if (request.areaId === 1) {
      return level(1, 0, 0, [
        { areaId: 1, tileX: 0, tileY: 0 },
        { areaId: 1, tileX: 60, tileY: 60 },
      ])
    }
    if (request.areaId === 2) return level(2, 1000, 1000, [{ areaId: 2, tileX: 200, tileY: 200 }])
    if (request.areaId === 40) return level(40, 2000, 2000, [{ areaId: 40, tileX: 400, tileY: 400 }])
    return null
  }
  return new GameInstance({
    seed: 1351,
    difficulty: 0,
    resolveAreaBootstrap: createAreaBootstrapResolver(source),
  })
}

function eventsOf(game: GameInstance, playerId: number): string[] {
  return game.drainEvents(playerId).map((e) => e.type)
}

describe('issue #1351 area transition stream', () => {
  it('omits LoadAct for a same-act transition and sends UnloadAct → LoadAct for an act change', () => {
    const game = makeGame()
    const playerId = game.connectPlayer({ charClass: 'sor', name: 'Walker', areaId: 1 })
    game.drainEvents(playerId)
    const record = (game as unknown as {
      players: Map<number, { areaId: number; unlockedAct: number }>
      transitionPlayerArea: (p: unknown, area: number, arrival: { kind: string }) => boolean
    }).players.get(playerId)!
    ;(game as unknown as {
      transitionPlayerArea: (p: unknown, area: number, arrival: { kind: string }) => boolean
    }).transitionPlayerArea(record, 2, { kind: 'townPortal' })
    let types = eventsOf(game, playerId)
    expect(types).not.toContain('LoadAct')
    expect(types).not.toContain('UnloadAct')
    expect(types).toContain('UnitReassign')

    record.unlockedAct = 1
    ;(game as unknown as {
      transitionPlayerArea: (p: unknown, area: number, arrival: { kind: string }) => boolean
    }).transitionPlayerArea(record, 40, { kind: 'townPortal' })
    types = eventsOf(game, playerId)
    const unload = types.indexOf('UnloadAct')
    const load = types.indexOf('LoadAct')
    expect(unload).toBeGreaterThanOrEqual(0)
    expect(load).toBeGreaterThan(unload)
    expect(types.indexOf('UnitReassign')).toBeGreaterThan(load)
  })

  it('reveals rooms by AOI and hides them when the player leaves the room range', () => {
    const game = makeGame()
    const playerId = game.connectPlayer({ charClass: 'sor', name: 'Roomer', areaId: 1 })
    const record = (game as unknown as {
      players: Map<number, { x: number; y: number; revealedRoomKeys: Set<string> }>
      revealAreaRoomsNearPlayer: (p: unknown) => void
    }).players.get(playerId)!
    game.drainEvents(playerId)
    expect([...record.revealedRoomKeys]).toEqual(['1:0:0'])

    record.x = 60 * 5
    record.y = 60 * 5
    ;(game as unknown as {
      revealAreaRoomsNearPlayer: (p: unknown) => void
    }).revealAreaRoomsNearPlayer(record)
    const types = eventsOf(game, playerId)
    expect(types).toContain('RoomReveal')
    expect(types).toContain('RoomHide')
    expect(record.revealedRoomKeys.has('1:60:60')).toBe(true)
  })

  it('NPC travel emits CanGoToAct and moves to the next act town', () => {
    const game = makeGame()
    const playerId = game.connectPlayer({ charClass: 'sor', name: 'Traveler', x: 20, y: 20, areaId: 1 })
    const record = (game as unknown as { players: Map<number, { areaId: number; unlockedAct: number }> }).players.get(playerId)!
    const npcId = game.spawnMonster({ defId: 'warriv1', x: 21, y: 20, areaId: 1, isNpc: true })
    // Warriv may only sail east after Andariel (a1q6).
    ;(game as unknown as {
      players: Map<number, { questFlags: Uint16Array }>
    }).players.get(playerId)!.questFlags[6] |= 0x0001
    game.drainEvents(playerId)

    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: npcId } })
    game.stepFrames(1)
    expect(eventsOf(game, playerId)).toContain('CanGoToAct')

    game.enqueueCommand(playerId, {
      type: 'NpcEntityAction',
      npcId,
      action: 0,
      complement: 40,
    })
    game.stepFrames(1)
    const types = eventsOf(game, playerId)
    expect(record.areaId).toBe(40)
    expect(types).toContain('UnloadAct')
    expect(types).toContain('LoadAct')
  })
})