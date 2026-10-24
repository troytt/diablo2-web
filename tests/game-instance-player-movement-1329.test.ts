/**
 * Issue #1329: server player locomotion must match the client `LocalMovementPredictor`
 * (D2Common 1.13c walk 9.0 / run 13.5 sub-tiles per second, collision-aware path), skip the
 * moving player's own client for walk/run `UnitMove`, downgrade run to walk on exhausted
 * stamina, and answer C2S `0x5F UpdatePlayerPos` like D2Game 0x6FC88530.
 */

import { describe, expect, it } from 'vitest'
import { LocalMovementPredictor } from '../src/common/path/movement-predictor.ts'
import type { ServerEvent } from '../src/netproto/index.ts'
import { GameInstance } from '../src/server/engine/game-instance.ts'

// Rogue Encampment: no wilderness room streaming (no monsters interfere); idle mode is TN (5).
const AREA = 1
const TICK_EPS = 1e-9

function makeGame(): GameInstance {
  return new GameInstance({ mode: 'open', maxPlayers: 8, seed: 1329, difficulty: 0, act: 0, areaId: AREA })
}

function connect(game: GameInstance, name: string, x: number, y: number): number {
  const id = game.connectPlayer({ charClass: 'bar', name, x, y, areaId: AREA })
  game.drainEvents(id)
  return id
}

function setStamina(game: GameInstance, playerId: number, stamina: number): void {
  const record = (game as unknown as { players: Map<number, { stamina: number }> }).players.get(
    playerId,
  )!
  record.stamina = stamina
}

function pos(game: GameInstance, id: number): { x: number; y: number } {
  const p = game.getPlayerState(id)!
  return { x: p.x, y: p.y }
}

function unitMovesFor(events: readonly ServerEvent[], unitId: number): ServerEvent[] {
  return events.filter(
    e => e.type === 'UnitMove' && Number((e as { id: number }).id) === unitId,
  )
}

describe('issue #1329: server player movement parity with the client predictor', () => {
  it('steps 0.54 sub-tiles per tick running and 0.36 walking (13.5 / 9.0 per second)', () => {
    const game = makeGame()
    const runner = connect(game, 'Runner', 100, 100)
    game.enqueueCommand(runner, { type: 'Move', to: { x: 140, y: 100 }, run: true })
    game.stepFrame()
    expect(pos(game, runner).x - 100).toBeCloseTo(0.54, 6)
    game.stepFrames(9)
    expect(pos(game, runner).x - 100).toBeCloseTo(5.4, 6)

    const walker = connect(game, 'Walker', 100, 200)
    game.enqueueCommand(walker, { type: 'Move', to: { x: 140, y: 200 }, run: false })
    game.stepFrames(25)
    expect(pos(game, walker).x - 100).toBeCloseTo(9.0, 6)
    expect(pos(game, walker).y).toBe(200)
  })

  it('stays tick-for-tick identical to the client LocalMovementPredictor on the same path', () => {
    const game = makeGame()
    const id = connect(game, 'Twin', 300, 300)
    const client = new LocalMovementPredictor({ initialX: 300, initialY: 300 })
    client.setPath([{ x: 317, y: 309 }], true)
    game.enqueueCommand(id, { type: 'Move', to: { x: 317, y: 309 }, run: true })
    for (let t = 0; t < 60; t++) {
      game.stepFrame()
      const snap = client.stepTicks(1)
      const p = pos(game, id)
      expect(Math.abs(p.x - snap.logicalX)).toBeLessThan(TICK_EPS + 1e-6)
      expect(Math.abs(p.y - snap.logicalY)).toBeLessThan(TICK_EPS + 1e-6)
    }
    expect(pos(game, id)).toEqual({ x: 317, y: 309 })
  })

  it('never walks through walls: detours around a short wall and stops at a long one', () => {
    // Short wall: column x = 108 blocked for y in [96, 104]; the goal is within the 18 sub-tile
    // local A* radius (16² < 18²), so the path detours around it.
    const detour = makeGame()
    const a = connect(detour, 'Detour', 100, 100)
    detour.setTerrainWalkableCheck((_area, x, y) => !(Math.round(x) === 108 && y >= 96 && y <= 104))
    detour.enqueueCommand(a, { type: 'Move', to: { x: 116, y: 100 }, run: true })
    let crossedWall = false
    for (let t = 0; t < 200; t++) {
      detour.stepFrame()
      const p = pos(detour, a)
      if (Math.round(p.x) === 108 && Math.round(p.y) >= 96 && Math.round(p.y) <= 104) {
        crossedWall = true
      }
    }
    expect(crossedWall).toBe(false)
    expect(pos(detour, a)).toEqual({ x: 116, y: 100 })

    // Long wall: column x = 110 fully blocked; the player must stop before it.
    const blocked = makeGame()
    const b = connect(blocked, 'Blocked', 100, 100)
    blocked.setTerrainWalkableCheck((_area, x) => Math.round(x) !== 110)
    blocked.enqueueCommand(b, { type: 'Move', to: { x: 120, y: 100 }, run: true })
    blocked.stepFrames(200)
    const end = pos(blocked, b)
    expect(end.x).toBeLessThan(110)
    const state = blocked.getPlayerState(b)!
    expect(state.targetX).toBe(end.x)
    expect(state.mode).toBe(5)
  })

  it('does not echo walk/run UnitMove to the moving player, but broadcasts it to others', () => {
    const game = makeGame()
    const mover = connect(game, 'Mover', 100, 100)
    const watcher = connect(game, 'Watcher', 105, 105)
    game.drainEvents(mover)
    game.enqueueCommand(mover, { type: 'Move', to: { x: 104, y: 100 }, run: true })
    game.stepFrames(20)

    const own = game.drainEvents(mover)
    expect(unitMovesFor(own, mover)).toHaveLength(0)
    // The owner gets an authoritative LifeMana position on arrival for its tolerance gate.
    const ownLifeMana = own.filter(e => e.type === 'LifeMana')
    expect(ownLifeMana.length).toBeGreaterThan(0)
    expect((ownLifeMana[ownLifeMana.length - 1] as { at: unknown }).at).toEqual({ x: 104, y: 100 })

    const seen = unitMovesFor(game.drainEvents(watcher), mover)
    expect(seen.length).toBeGreaterThan(1)
    expect(seen.slice(0, -1).every(e => (e as { mode: string }).mode === 'run')).toBe(true)
    const last = seen[seen.length - 1] as { mode: string; to: { x: number; y: number } }
    expect(last.mode).toBe('stop')
    expect(last.to).toEqual({ x: 104, y: 100 })
  })

  it('downgrades running to walking when stamina is exhausted', () => {
    const game = makeGame()
    const id = connect(game, 'Tired', 100, 100)
    const watcher = connect(game, 'Watcher', 105, 105)
    setStamina(game, id, 0)
    game.drainEvents(watcher)
    game.enqueueCommand(id, { type: 'Move', to: { x: 140, y: 100 }, run: true })
    game.stepFrames(25)
    expect(pos(game, id).x - 100).toBeCloseTo(9.0, 6)
    const state = game.getPlayerState(id)!
    expect(state.run).toBe(false)
    expect(state.mode).toBe(2)
    const modes = unitMovesFor(game.drainEvents(watcher), id).map(e => (e as { mode: string }).mode)
    expect(modes.length).toBeGreaterThan(0)
    expect(modes.every(m => m === 'walk')).toBe(true)
  })

  describe('C2S 0x5F UpdatePlayerPos (D2Game 0x6FC88530)', () => {
    it('ignores reports within distance 5', () => {
      const game = makeGame()
      const id = connect(game, 'Near', 100, 100)
      game.enqueueCommand(id, { type: 'UpdatePlayerPos', x: 103, y: 102 })
      game.stepFrame()
      expect(pos(game, id)).toEqual({ x: 100, y: 100 })
      expect(game.drainEvents(id).some(e => e.type === 'UnitReassign')).toBe(false)
    })

    it('walks toward the client position below distance 15', () => {
      const game = makeGame()
      const id = connect(game, 'Drift', 100, 100)
      game.enqueueCommand(id, { type: 'UpdatePlayerPos', x: 110, y: 100 })
      game.stepFrame()
      expect(pos(game, id).x).toBeCloseTo(100.36, 6)
      expect(game.drainEvents(id).some(e => e.type === 'UnitReassign')).toBe(false)
    })

    it('warps to a reachable client position in [15, 45] without reassigning the owner', () => {
      const game = makeGame()
      const id = connect(game, 'Warp', 100, 100)
      const watcher = connect(game, 'Watcher', 110, 110)
      game.enqueueCommand(id, { type: 'UpdatePlayerPos', x: 120, y: 100 })
      game.stepFrame()
      expect(pos(game, id)).toEqual({ x: 120, y: 100 })
      expect(game.drainEvents(id).some(e => e.type === 'UnitReassign')).toBe(false)
      const others = game.drainEvents(watcher).filter(e => e.type === 'UnitReassign')
      expect(others).toHaveLength(1)
      expect((others[0] as { at: unknown }).at).toEqual({ x: 120, y: 100 })

      // STATE_SYNC_WARPED: a second in-band report within 125 frames walks instead of warping.
      game.enqueueCommand(id, { type: 'UpdatePlayerPos', x: 140, y: 100 })
      game.stepFrame()
      expect(pos(game, id).x).toBeCloseTo(120.36, 6)
    })

    it('answers S2C 0x15 with the server position when the client position is unreachable', () => {
      const game = makeGame()
      const id = connect(game, 'Cheat', 100, 100)
      game.setTerrainWalkableCheck((_area, x) => Math.round(x) !== 110)
      game.enqueueCommand(id, { type: 'UpdatePlayerPos', x: 120, y: 100 })
      game.stepFrame()
      expect(pos(game, id)).toEqual({ x: 100, y: 100 })
      const reassign = game.drainEvents(id).filter(e => e.type === 'UnitReassign')
      expect(reassign).toHaveLength(1)
      expect(reassign[0]).toMatchObject({ unitType: 0, id, at: { x: 100, y: 100 }, snap: false })
    })

    it('ignores reports from a dead player', () => {
      const game = makeGame()
      const id = connect(game, 'Dead', 100, 100)
      ;(game as unknown as { players: Map<number, { dead: boolean }> }).players.get(id)!.dead = true
      game.enqueueCommand(id, { type: 'UpdatePlayerPos', x: 120, y: 100 })
      game.stepFrame()
      expect(pos(game, id)).toEqual({ x: 100, y: 100 })
      expect(game.drainEvents(id).some(e => e.type === 'UnitReassign')).toBe(false)
    })
  })
})
