/**
 * Issue #1347 — 1.13c special monster AI: race-aware resurrection with S1 cast,
 * unify monster-vs-monster damage/death, morale probability, fear pathing, champion taunt.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

function connectTestPlayer(game: GameInstance, x = 80, y = 80): number {
  return game.connectPlayer({
    charClass: 'bar',
    name: 'Target',
    x,
    y,
    areaId: 1,
  })
}

function hasModeEvent(
  events: readonly { type: string }[],
  id: number,
  mode: number,
): boolean {
  return events.some(
    (e) =>
      e.type === 'UnitMode' &&
      (e as { id?: number }).id === id &&
      (e as { mode?: number }).mode === mode,
  )
}

describe('issue #1347 special monster AI', () => {
  it('revives only the same MonType, with an S1 cast and aip-controlled cadence', () => {
    const game = new GameInstance({ seed: 1347, areaId: 1 })
    const playerId = connectTestPlayer(game)
    const shaman = game.spawnMonster({
      defId: 'fallenshaman1',
      x: 30,
      y: 30,
      areaId: 1,
      aiParams: [45, 60, 100, 24, 15],
    })
    const fallenCorpse = game.spawnMonster({
      defId: 'fallen1',
      x: 31,
      y: 30,
      areaId: 1,
      maxHp: 50,
      hp: 50,
      aiParams: [0, 0, 0, 0, 0],
    })
    const mummyCorpse = game.spawnMonster({
      defId: 'mummy1',
      x: 32,
      y: 30,
      areaId: 1,
      maxHp: 50,
      hp: 50,
    })
    game.applyDamageToMonster(fallenCorpse, 1000, playerId)
    game.applyDamageToMonster(mummyCorpse, 1000, playerId)
    game.drainEvents(playerId)

    game.stepFrames(10)
    expect(game.getMonsterState(fallenCorpse)!.dead).toBe(false)
    expect(game.getMonsterState(fallenCorpse)!.hp).toBe(50)
    expect(game.getMonsterState(mummyCorpse)!.dead).toBe(true)
    const events = game.drainEvents(playerId)
    expect(hasModeEvent(events, shaman, 8), 'shaman S1 resurrection cast').toBe(true)
    expect(hasModeEvent(events, fallenCorpse, 1)).toBe(true)

    // A revived corpse can be raised again after dying (revivedByShaman is not a lifetime lock).
    game.applyDamageToMonster(fallenCorpse, 1000, playerId)
    game.stepFrames(50)
    expect(game.getMonsterState(fallenCorpse)!.dead).toBe(false)
  })

  it('Greater Mummy raises undead, not living Fallen', () => {
    const game = new GameInstance({ seed: 1348, areaId: 1 })
    const playerId = connectTestPlayer(game)
    const mummyPriest = game.spawnMonster({
      defId: 'unraveler1',
      x: 30,
      y: 30,
      areaId: 1,
      aiParams: [70, 30, 40, 60, 24],
    })
    const mummyCorpse = game.spawnMonster({
      defId: 'mummy1',
      x: 31,
      y: 30,
      areaId: 1,
      maxHp: 50,
      hp: 50,
    })
    const fallenCorpse = game.spawnMonster({
      defId: 'fallen1',
      x: 32,
      y: 30,
      areaId: 1,
      maxHp: 50,
      hp: 50,
      aiParams: [0, 0, 0, 0, 0],
    })
    game.applyDamageToMonster(mummyCorpse, 1000, playerId)
    game.applyDamageToMonster(fallenCorpse, 1000, playerId)
    game.drainEvents(playerId)

    game.stepFrames(10)
    expect(game.getMonsterState(mummyCorpse)!.dead).toBe(false)
    expect(game.getMonsterState(fallenCorpse)!.dead).toBe(true)
    expect(game.getMonsterState(mummyPriest)!.mode).toBe(8)
  })

  it('confused monsters use the damage pipeline and broadcast the death mode', () => {
    const game = new GameInstance({ seed: 1349, areaId: 1 })
    const playerId = connectTestPlayer(game, 80, 80)
    const attacker = game.spawnMonster({
      defId: 'fallen1',
      x: 30,
      y: 30,
      areaId: 1,
      maxHp: 500,
      hp: 500,
      minDmg: 50,
      maxDmg: 50,
      ar: 100000,
      damageRegen: 0,
    })
    const victim = game.spawnMonster({
      defId: 'fallen1',
      x: 31,
      y: 30,
      areaId: 1,
      maxHp: 60,
      hp: 60,
      minDmg: 1,
      maxDmg: 1,
      ac: 0,
      damageRegen: 0,
    })
    game.applyMonsterState(attacker, 59, 300)
    game.drainEvents(playerId)
    const xpBefore = game.getPlayerState(playerId)!.experience

    game.stepFrames(120)
    expect(game.getMonsterState(victim)!.dead).toBe(true)
    const events = game.drainEvents(playerId)
    expect(hasModeEvent(events, victim, 12), 'death UnitMode 12 broadcast').toBe(true)
    expect(game.getPlayerState(playerId)!.experience).toBeGreaterThan(xpBefore)
  })

  it('morale panic uses the dead monster aip1 chance and the same MonType', () => {
    const game = new GameInstance({ seed: 1350, areaId: 1 })
    const playerId = connectTestPlayer(game)
    const dyingZero = game.spawnMonster({
      defId: 'fallen1',
      x: 30,
      y: 30,
      areaId: 1,
      aiParams: [0, 0, 0, 0, 0],
    })
    const allyFallen = game.spawnMonster({
      defId: 'fallen1',
      x: 31,
      y: 30,
      areaId: 1,
    })
    const allyFetish = game.spawnMonster({
      defId: 'fetish1',
      x: 32,
      y: 30,
      areaId: 1,
    })
    game.applyDamageToMonster(dyingZero, 1000, playerId)
    expect(game.getMonsterState(allyFallen)!.fleeTicks).toBe(0)
    expect(game.getMonsterState(allyFetish)!.fleeTicks).toBe(0)

    const dyingAlways = game.spawnMonster({
      defId: 'fallen1',
      x: 40,
      y: 30,
      areaId: 1,
      aiParams: [100, 0, 0, 0, 0],
    })
    const allyFallen2 = game.spawnMonster({
      defId: 'fallen1',
      x: 41,
      y: 30,
      areaId: 1,
    })
    game.applyDamageToMonster(dyingAlways, 1000, playerId)
    expect(game.getMonsterState(allyFallen2)!.fleeTicks).toBeGreaterThan(0)
  })

  it('fear flees around a wall instead of stopping at the blocked straight line', () => {
    const game = new GameInstance({ seed: 1352, areaId: 1 })
    connectTestPlayer(game, 30, 30)
    // A wall east of the monster (x >= 37, y 29..31) blocks the direct away line.
    game.setTerrainWalkableCheck(
      (_areaId, x, y) => !(x >= 37 && y >= 29 && y <= 31),
    )
    const monster = game.spawnMonster({
      defId: 'fallen1',
      x: 35,
      y: 30,
      areaId: 1,
      runSpeed: 30,
      velocity: 30,
    })
    game.applyMonsterState(monster, 56, 100)
    const before = game.getMonsterState(monster)!
    game.stepFrames(25)
    const after = game.getMonsterState(monster)!
    expect(Math.hypot(after.x - 30, after.y - 30)).toBeGreaterThan(
      Math.hypot(before.x - 30, before.y - 30) + 2,
    )
  })

  it('taunt reaches champions but not bosses/uniques', () => {
    const game = new GameInstance({ seed: 1351, areaId: 1 })
    connectTestPlayer(game)
    const champion = game.spawnMonster({
      defId: 'fallen1',
      x: 30,
      y: 30,
      areaId: 1,
      rank: 'champion',
    })
    const unique = game.spawnMonster({
      defId: 'fallen1',
      x: 32,
      y: 30,
      areaId: 1,
      rank: 'unique',
    })
    expect(game.applyMonsterState(champion, 27, 100)).toBe(true)
    expect(game.getMonsterState(champion)!.states.has(27)).toBe(true)
    expect(game.applyMonsterState(unique, 27, 100)).toBe(false)
    expect(game.getMonsterState(unique)!.states.has(27)).toBe(false)
  })
})