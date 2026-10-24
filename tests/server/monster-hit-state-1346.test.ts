/**
 * Issue #1346 — 1.13c monster hit reaction, knockback, slow percentages,
 * freeze/stun mode broadcast, and MonStats `DamageRegen`.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

function connectTestPlayer(game: GameInstance): number {
  return game.connectPlayer({
    charClass: 'bar',
    name: 'Target',
    x: 10,
    y: 10,
    areaId: 1,
  })
}

describe('issue #1346 monster hit reaction', () => {
  it('only enters GetHit at the 1.13c 3/8 max-life tier', () => {
    const game = new GameInstance({ seed: 1346, areaId: 1 })
    const playerId = connectTestPlayer(game)
    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 12,
      y: 10,
      areaId: 1,
      maxHp: 1600,
      hp: 1600,
      damageRegen: 0,
    })
    game.drainEvents(playerId)

    game.applyDamageToMonster(monsterId, 50, playerId)
    let events = game.drainEvents(playerId)
    expect(
      events.some(
        (e) =>
          e.type === 'UnitMode' &&
          (e as { id?: number }).id === monsterId &&
          (e as { mode?: number }).mode === 3,
      ),
    ).toBe(false)

    game.applyDamageToMonster(monsterId, 600, playerId)
    events = game.drainEvents(playerId)
    expect(
      events.some(
        (e) =>
          e.type === 'UnitMode' &&
          (e as { id?: number }).id === monsterId &&
          (e as { mode?: number }).mode === 3,
      ),
    ).toBe(true)
  })

  it('knocks the monster away from the attacker with a 0x14 knockback path', () => {
    const game = new GameInstance({ seed: 1346, areaId: 1 })
    const playerId = connectTestPlayer(game)
    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 12,
      y: 10,
      areaId: 1,
      maxHp: 5000,
      hp: 5000,
      damageRegen: 0,
    })
    const before = game.getMonsterState(monsterId)!
    game.drainEvents(playerId)

    // Bash (#126) is a 100% knockback skill; 1.13c still rolls the monster's
    // size resistance (Medium 50%), so retry until the deterministic RNG lands.
    let after = game.getMonsterState(monsterId)!
    for (let attempt = 0; attempt < 10 && after.x <= before.x; attempt++) {
      game.applyDamageToMonster(monsterId, 10, playerId, 126)
      after = game.getMonsterState(monsterId)!
    }
    expect(after.x).toBeGreaterThan(before.x)
    const events = game.drainEvents(playerId)
    expect(
      events.some(
        (e) =>
          e.type === 'UnitMove' &&
          (e as { id?: number }).id === monsterId &&
          (e as { mode?: string }).mode === 'knockback',
      ),
    ).toBe(true)
  })

  it('uses ColdEffect, Decrepify -50%, and Holy Freeze velocitypercent for slow', () => {
    const game = new GameInstance({ seed: 1346, areaId: 1 })
    connectTestPlayer(game)
    const normalCold = game.spawnMonster({
      defId: 'fallen1',
      x: 30,
      y: 10,
      areaId: 1,
      coldEffect: -50,
      damageRegen: 0,
    })
    const mildCold = game.spawnMonster({
      defId: 'fallen1',
      x: 34,
      y: 10,
      areaId: 1,
      coldEffect: -25,
      damageRegen: 0,
    })
    const recollect = (id: number) =>
      (game as unknown as { monsters: Map<number, unknown> }).monsters.get(id)

    const baseSpeed = (
      game as unknown as {
        monsterStepSpeed: (m: unknown, running: boolean) => number
      }
    ).monsterStepSpeed(recollect(normalCold), false)

    game.applyMonsterState(normalCold, 11, 100)
    game.applyMonsterState(mildCold, 11, 100)
    const coldSpeed = (
      game as unknown as {
        monsterStepSpeed: (m: unknown, running: boolean) => number
      }
    ).monsterStepSpeed(recollect(normalCold), false)
    const mildColdSpeed = (
      game as unknown as {
        monsterStepSpeed: (m: unknown, running: boolean) => number
      }
    ).monsterStepSpeed(recollect(mildCold), false)
    expect(coldSpeed).toBeCloseTo(baseSpeed * 0.5, 5)
    expect(mildColdSpeed).toBeCloseTo(baseSpeed * 0.75, 5)

    const decrepified = game.spawnMonster({
      defId: 'fallen1',
      x: 38,
      y: 10,
      areaId: 1,
      damageRegen: 0,
    })
    game.applyMonsterState(decrepified, 60, 100)
    const decrepSpeed = (
      game as unknown as {
        monsterStepSpeed: (m: unknown, running: boolean) => number
      }
    ).monsterStepSpeed(recollect(decrepified), false)
    expect(decrepSpeed).toBeCloseTo(baseSpeed * 0.5, 5)
  })

  it('broadcasts the neutral mode once when frozen or stunned', () => {
    const game = new GameInstance({ seed: 1346, areaId: 1 })
    const playerId = connectTestPlayer(game)
    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 12,
      y: 10,
      areaId: 1,
      damageRegen: 0,
    })
    const record = (
      game as unknown as { monsters: Map<number, { mode: number }> }
    ).monsters.get(monsterId)!
    record.mode = 2
    game.applyMonsterState(monsterId, 1, 30)
    game.drainEvents(playerId)

    game.stepFrames(1)
    const events = game.drainEvents(playerId)
    const neutralModes = events.filter(
      (e) =>
        e.type === 'UnitMode' &&
        (e as { id?: number }).id === monsterId &&
        (e as { mode?: number }).mode === 1,
    )
    expect(neutralModes).toHaveLength(1)
  })

  it('regenerates life from MonStats DamageRegen (maxHp * value / 8192 per frame)', () => {
    const game = new GameInstance({ seed: 1346, areaId: 1 })
    const playerId = connectTestPlayer(game)
    const monsterId = game.spawnMonster({
      defId: 'zombie1',
      x: 25,
      y: 10,
      areaId: 1,
      maxHp: 2000,
      hp: 2000,
      damageRegen: 8,
      aiDisabled: true,
    })
    game.applyDamageToMonster(monsterId, 1000, playerId)
    const damaged = game.getMonsterState(monsterId)!.hp
    game.stepFrames(25)
    const healed = game.getMonsterState(monsterId)!.hp
    // 2000 * 8 / 8192 = 1.953 HP per frame, ~48 HP over 25 frames.
    expect(healed - damaged).toBeGreaterThanOrEqual(40)
    expect(healed).toBeLessThanOrEqual(2000)
  })

  it('freeze cancels a pending melee action frame', () => {
    const game = new GameInstance({ seed: 13461, areaId: 1 })
    const playerId = connectTestPlayer(game)
    const monsterId = game.spawnMonster({
      defId: 'fallen1', x: 11, y: 10, areaId: 1, hp: 500, maxHp: 500, damageRegen: 0,
    })
    game.stepFrames(1)
    const monster = (game as unknown as {
      monsters: Map<number, { pendingAttack: unknown }>
    }).monsters.get(monsterId)!
    expect(monster.pendingAttack).toBeDefined()
    game.applyMonsterState(monsterId, 1, 100)
    const hp = game.getPlayerState(playerId)!.hp
    game.stepFrames(20)
    expect(game.getPlayerState(playerId)!.hp).toBe(hp)
  })
})
