/**
 * Issue #1353 follow-up — Den of Evil requires every DRLG room to be populated.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { questWordIndex113c } from '../../src/server/engine/quests-113c.ts'

describe('issue #1353 Den of Evil room completeness', () => {
  it('does not complete a1q1 while rooms are still unpopulated', () => {
    const game = new GameInstance({ seed: 1353, areaId: 8 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Hero', x: 10, y: 10, areaId: 8 })
    const player = (game as unknown as { players: Map<number, { questFlags: Uint16Array }> })
      .players.get(playerId)!
    ;(game as unknown as { areaPopulations: Map<number, unknown> }).areaPopulations.set(8, {
      rooms: [
        { index: 0, x: 0, y: 0, w: 10, h: 10, seed: 0 },
        { index: 1, x: 20, y: 0, w: 10, h: 10, seed: 0 },
      ],
      plan: null,
      populated: new Set([0]),
    })
    const monsterId = game.spawnMonster({ defId: 'fallen1', x: 12, y: 10, areaId: 8, hp: 5, maxHp: 5 })
    game.applyDamageToMonster(monsterId, 100, playerId)
    const index = questWordIndex113c('a1q1')!
    expect(player.questFlags[index]! & 0x0001).toBe(0)

    ;(game as unknown as { areaPopulations: Map<number, { populated: Set<number> }> })
      .areaPopulations.get(8)!.populated.add(1)
    const secondId = game.spawnMonster({ defId: 'fallen1', x: 12, y: 10, areaId: 8, hp: 5, maxHp: 5 })
    game.applyDamageToMonster(secondId, 100, playerId)
    expect(player.questFlags[index]! & 0x0001).toBe(1)
  })
})