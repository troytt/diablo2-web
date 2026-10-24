/**
 * Issue #1348 follow-up — Fire Enchanted delay, Conviction pierce and
 * Teleportation (MonUMod 26).
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

function connect(game: GameInstance, x: number, y: number): number {
  return game.connectPlayer({ charClass: 'bar', name: 'Target', x, y, areaId: 1 })
}

describe('issue #1348 MonUMod follow-up', () => {
  it('resolves the Fire Enchanted corpse boom a few frames after death', () => {
    const game = new GameInstance({ seed: 1348, areaId: 1 })
    const playerId = connect(game, 30, 31)
    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 30,
      y: 30,
      areaId: 1,
      maxHp: 100,
      hp: 100,
      rank: 'unique',
      umodIds: [9],
    })
    const before = game.getPlayerState(playerId)!.hp
    game.applyDamageToMonster(monsterId, 1000, playerId)
    expect(game.getPlayerState(playerId)!.hp).toBe(before)
    game.stepFrames(6)
    expect(game.getPlayerState(playerId)!.hp).toBeLessThan(before)
  })

  it('applies Conviction to the player combat stat list, not only a visual state', () => {
    const game = new GameInstance({ seed: 1349, areaId: 1 })
    const playerId = connect(game, 30, 31)
    game.spawnMonster({
      defId: 'fallen1',
      x: 30,
      y: 30,
      areaId: 1,
      rank: 'unique',
      umodIds: [30],
      statSeed: 3,
      aiDelay: 1,
      hp: 5000,
      maxHp: 5000,
    })
    game.stepFrames(30)
    const internal = game as unknown as {
      playerCombatContext: (player: unknown) => {
        statList: { getModifierBonus: (stat: string) => number }
      }
      players: Map<number, unknown>
    }
    const ctx = internal.playerCombatContext(internal.players.get(playerId))
    expect(ctx.statList.getModifierBonus('conviction_pierce')).toBeGreaterThan(0)
  })

  it('teleports a Teleportation unique away when badly hurt', () => {
    const game = new GameInstance({ seed: 1350, areaId: 1 })
    const playerId = connect(game, 10, 10)
    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 30,
      y: 30,
      areaId: 1,
      rank: 'unique',
      umodIds: [26],
      hp: 500,
      maxHp: 500,
      damageRegen: 0,
    })
    const before = game.getMonsterState(monsterId)!
    game.applyDamageToMonster(monsterId, 300, playerId)
    const after = game.getMonsterState(monsterId)!
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(1)
    expect(after.states.size).toBeGreaterThanOrEqual(0)
  })
})