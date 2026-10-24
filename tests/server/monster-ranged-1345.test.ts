/**
 * Issue #1345 — ranged monsters use their MonStats MissA1/MissA2 row, not missile id 1.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { getMissileTxtData } from '../../src/common/skills/missiles-data.ts'

describe('issue #1345 monster ranged attack', () => {
  it('fires the MonStats MissA1 missile row for a Corrupt Archer', () => {
    const game = new GameInstance({ seed: 1345, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Target', x: 10, y: 10, areaId: 1 })
    const archerId = game.spawnMonster({
      hcIdx: 160,
      defId: 'cr_archer1',
      x: 24,
      y: 10,
      areaId: 1,
      aggroRadius: 40,
    })
    expect(game.getMonster(archerId)!.isRanged).toBe(true)
    game.drainEvents(playerId)
    game.stepFrames(30)
    const missiles = game
      .drainEvents(playerId)
      .filter(e => e.type === 'CreateMissile')
    expect(missiles.length).toBeGreaterThan(0)
    expect((missiles[0] as { missileClassId?: number }).missileClassId).toBe(
      getMissileTxtData('cr_arrow1').id,
    )
  })
})