/**
 * Issue #1344 — melee monsters broadcast the attack mode before resolving damage.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

describe('issue #1344 monster melee attack', () => {
  it('broadcasts the A1 attack mode (UnitMode 4) when it swings', () => {
    const game = new GameInstance({ seed: 1344, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'bar', name: 'Target', x: 10, y: 10, areaId: 1 })
    const monsterId = game.spawnMonster({
      defId: 'fallen1', x: 11, y: 10, areaId: 1, minDmg: 5, maxDmg: 8, ar: 5000,
    })
    game.drainEvents(playerId)
    game.stepFrames(20)
    const events = game.drainEvents(playerId)
    expect(
      events.some(
        e => e.type === 'UnitMode' && (e as { id?: number }).id === monsterId && (e as { mode?: number }).mode === 4,
      ),
    ).toBe(true)
  })
})