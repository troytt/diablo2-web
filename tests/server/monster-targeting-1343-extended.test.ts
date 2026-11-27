/**
 * Issue #1343 — room sleep, line of sight, last-attacker threat and
 * mercenary/summon combat.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

function connect(game: GameInstance, x: number, y: number, name = 'Target'): number {
  return game.connectPlayer({ charClass: 'bar', name, x, y, areaId: 2 })
}

describe('issue #1343 monster targeting', () => {
  it('does not aggro through a wall (strict LOS, no path fallback)', () => {
    const game = new GameInstance({ seed: 1343, areaId: 2 })
    connect(game, 14, 10)
    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 10,
      y: 10,
      areaId: 2,
      aggroRadius: 40,
    })
    game.setTerrainWalkableCheck((_areaId, x) => x !== 12)
    game.stepFrames(30)
    expect(game.getMonster(monsterId)!.x).toBe(10)
  })

  it('sleeps monsters outside the player AOI even with a large aggro radius', () => {
    const game = new GameInstance({ seed: 1344, areaId: 2 })
    connect(game, 10, 10)
    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 100,
      y: 10,
      areaId: 2,
      aggroRadius: 200,
    })
    const before = game.getMonster(monsterId)!.x
    game.stepFrames(30)
    expect(game.getMonster(monsterId)!.x).toBe(before)
  })

  it('retaliates against the last attacker outside its normal aggro radius', () => {
    const game = new GameInstance({ seed: 1345, areaId: 2 })
    const playerId = connect(game, 10, 10)
    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 30,
      y: 10,
      areaId: 2,
      aggroRadius: 5,
      hp: 500,
      maxHp: 500,
      aiDisabled: false,
    })
    game.applyDamageToMonster(monsterId, 1, playerId)
    const before = game.getMonster(monsterId)!.x
    game.stepFrames(20)
    expect(game.getMonster(monsterId)!.x).toBeLessThan(before)
  })

  it('melee attacks on mercenaries use the combat pipeline and broadcast the swing', () => {
    const game = new GameInstance({ seed: 1346, areaId: 2 })
    const playerId = connect(game, 10, 30)
    const mercId = game.hireMercenary(playerId, {
      x: 12,
      y: 10,
      level: 5,
      hp: 500,
      maxHp: 500,
    })
    game.spawnMonster({
      defId: 'fallen1',
      x: 10,
      y: 10,
      areaId: 2,
      level: 99,
      ar: 100_000,
      minDmg: 20,
      maxDmg: 20,
      hp: 5000,
      maxHp: 5000,
      aggroRadius: 40,
    })
    game.drainEvents(playerId)
    const internal = game as unknown as {
      mercenaries: Map<number, { hp: number }>
    }
    const before = internal.mercenaries.get(mercId)!.hp
    game.stepFrames(15)
    const events = game.drainEvents(playerId)
    expect(internal.mercenaries.get(mercId)!.hp).toBeLessThan(before)
    expect(
      events.some(
        (e) => e.type === 'UnitMode' && (e as { unitType?: unknown }).unitType === 1,
      ),
    ).toBe(true)
  })

  it('keeps targeting an adjacent mercenary/summon even after taking damage from the owner', () => {
    const game = new GameInstance({ seed: 1347, areaId: 2 })
    const playerId = connect(game, 25, 10)
    const mercId = game.hireMercenary(playerId, {
      x: 11,
      y: 10,
      level: 10,
      hp: 500,
      maxHp: 500,
    })
    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 10,
      y: 10,
      areaId: 2,
      level: 50,
      ar: 100_000,
      minDmg: 25,
      maxDmg: 25,
      hp: 5000,
      maxHp: 5000,
      aggroRadius: 20,
    })
    // Merc/player damage sets threatPlayerId on the monster; the monster must
    // still swing at the adjacent merc (dist 1) rather than walking toward the
    // player at x=25.
    game.applyDamageToMonster(monsterId, 10, playerId)
    const internal = game as unknown as {
      mercenaries: Map<number, { hp: number }>
    }
    const beforeHp = internal.mercenaries.get(mercId)!.hp
    game.stepFrames(12)
    expect(internal.mercenaries.get(mercId)!.hp).toBeLessThan(beforeHp)
  })

  it('broadcasts UnitStatUpdate(6) and UnitRemove and cleans up SummonManager when a monster kills a summon', () => {
    const game = new GameInstance({ seed: 1348, areaId: 2 })
    const playerId = connect(game, 25, 10)
    const petOut = game.summonPet(playerId, {
      skillId: 75, // Clay Golem
      slvl: 1,
      x: 11,
      y: 10,
    })
    expect(petOut.created).toBe(true)
    const pet = petOut.pet!
    pet.hp = 10
    pet.statList.setHp256(10 * 256)
    expect(game.getPetsForOwner(playerId)).toHaveLength(1)

    game.spawnMonster({
      defId: 'fallen1',
      x: 10,
      y: 10,
      areaId: 2,
      level: 99,
      ar: 100_000,
      minDmg: 200,
      maxDmg: 200,
      hp: 5000,
      maxHp: 5000,
      aggroRadius: 20,
      aiDelay: 4,
    })
    game.drainEvents(playerId)
    game.stepFrames(40)
    const events = game.drainEvents(playerId)
    expect(pet.alive).toBe(false)
    expect(game.getPetsForOwner(playerId)).toHaveLength(0)
    expect(
      events.some(
        (e) =>
          e.type === 'UnitStatUpdate' &&
          (e as { unitType?: unknown; statId?: unknown }).unitType === 'monster' &&
          (e as { statId?: unknown }).statId === 6,
      ),
    ).toBe(true)
    expect(
      events.some(
        (e) =>
          e.type === 'UnitRemove' &&
          (e as { unitType?: unknown }).unitType === 'monster',
      ),
    ).toBe(true)
  })

  it('cancels pendingAllyAttack when the monster is stunned or knocked back and blocks cross-area hits', () => {
    const game = new GameInstance({ seed: 1349, areaId: 2 })
    const playerId = connect(game, 25, 10)
    const mercId = game.hireMercenary(playerId, {
      x: 11,
      y: 10,
      level: 10,
      hp: 500,
      maxHp: 500,
    })
    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 10,
      y: 10,
      areaId: 2,
      level: 99,
      ar: 100_000,
      minDmg: 100,
      maxDmg: 100,
      hp: 5000,
      maxHp: 5000,
      aggroRadius: 20,
    })
    const internal = game as unknown as {
      monsters: Map<number, { pendingAllyAttack?: unknown }>
      mercenaries: Map<number, { hp: number }>
      players: Map<number, { areaId: number }>
      applyMonsterState: (unitId: number, state: number, dur: number) => boolean
    }
    game.stepFrames(1)
    expect(internal.monsters.get(monsterId)!.pendingAllyAttack).toBeDefined()
    internal.applyMonsterState(monsterId, 21, 10) // stun clears pendingAllyAttack
    expect(internal.monsters.get(monsterId)!.pendingAllyAttack).toBeUndefined()

    // Once stun expires and a new swing starts, moving the owner to another area
    // before the action frame lands must prevent cross-area damage.
    game.stepFrames(11)
    internal.players.get(playerId)!.areaId = 3
    const beforeHp = internal.mercenaries.get(mercId)!.hp
    game.stepFrames(10)
    expect(internal.mercenaries.get(mercId)!.hp).toBe(beforeHp)
  })
})