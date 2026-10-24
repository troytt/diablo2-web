/**
 * Issue #1346 follow-up — GetHit animation lock and regen suppression.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

function connect(game: GameInstance): number {
  return game.connectPlayer({ charClass: 'bar', name: 'Target', x: 10, y: 10, areaId: 1 })
}

describe('issue #1346 hit recovery follow-up', () => {
  it('locks the AI for the GetHit animation and clears a pending swing', () => {
    const game = new GameInstance({ seed: 1346, areaId: 1 })
    const playerId = connect(game)
    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 12,
      y: 10,
      areaId: 1,
      maxHp: 1600,
      hp: 1600,
      damageRegen: 0,
      minDmg: 10,
      maxDmg: 10,
      ar: 100_000,
    })
    const internal = game as unknown as {
      monsters: Map<
        number,
        {
          pendingAttack?: unknown
          hitRecoveryUntilFrame: number
          mode: number
          x: number
        }
      >
    }
    // Put the monster in the middle of an A1 wind-up.
    const record = internal.monsters.get(monsterId)!
    record.pendingAttack = {
      playerId,
      frame: game.frame + 3,
      mode: 4,
      skillMode: 'A1',
      minDmg: 10,
      maxDmg: 10,
    }
    game.applyDamageToMonster(monsterId, 600, playerId)
    expect(record.pendingAttack).toBeUndefined()
    expect(record.hitRecoveryUntilFrame).toBeGreaterThan(game.frame)
    expect(record.mode).toBe(3)

    // The AI stays locked while GH plays.
    game.stepFrames(2)
    expect(record.hitRecoveryUntilFrame).toBeGreaterThan(game.frame)
  })

  it('suspends DamageRegen while Poison (2), Open Wounds (62) or Prevent Heal (52) is active', () => {
    const game = new GameInstance({ seed: 1347, areaId: 1 })
    const playerId = connect(game)
    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 12,
      y: 10,
      areaId: 1,
      maxHp: 5000,
      hp: 3000,
      damageRegen: 100,
    })
    game.applyMonsterState(monsterId, 2, 200)
    const beforePoison = game.getMonsterState(monsterId)!.hp
    game.stepFrames(120)
    expect(game.getMonsterState(monsterId)!.hp).toBe(beforePoison)

    game.applyMonsterState(monsterId, 52, 200)
    game.stepFrames(120)
    expect(game.getMonsterState(monsterId)!.hp).toBe(beforePoison)
    void playerId
  })

  it('uses AnimData.d2 GH duration per monster token and skips neverCount / mGH=0 traps', () => {
    const game = new GameInstance({ seed: 1346, areaId: 1 })
    const playerId = connect(game)
    // zombie1 (ZM) has ZMGHHTH: 8 frames @ speed 256 -> 8 frames (distinct from fallen1's 6 frames)
    const zombieId = game.spawnMonster({
      defId: 'zombie1',
      x: 12,
      y: 10,
      areaId: 1,
      maxHp: 1000,
      hp: 1000,
      damageRegen: 0,
    })
    // gargoyletrap has neverCount=1 and mGH=0 in MonStats/MonStats2
    const trapId = game.spawnMonster({
      defId: 'gargoyletrap',
      x: 14,
      y: 10,
      areaId: 1,
      maxHp: 1000,
      hp: 1000,
      damageRegen: 0,
    })
    const internal = game as unknown as {
      monsters: Map<number, { hitRecoveryUntilFrame: number; mode: number }>
    }
    const frameBefore = game.frame
    game.applyDamageToMonster(zombieId, 500, playerId)
    const zombieRec = internal.monsters.get(zombieId)!
    expect(zombieRec.mode).toBe(3)
    expect(zombieRec.hitRecoveryUntilFrame - frameBefore).toBe(8)

    game.applyDamageToMonster(trapId, 500, playerId)
    const trapRec = internal.monsters.get(trapId)!
    expect(trapRec.mode).not.toBe(3)
    expect(trapRec.hitRecoveryUntilFrame).toBeLessThanOrEqual(frameBefore)
  })

  it('cancels pendingAllyAttack on GetHit, direct applyUnitState stun, or frozenTicks', () => {
    const game = new GameInstance({ seed: 1346, areaId: 1 })
    const playerId = connect(game)
    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 12,
      y: 10,
      areaId: 1,
      maxHp: 1600,
      hp: 1600,
      damageRegen: 0,
    })
    const internal = game as unknown as {
      monsters: Map<
        number,
        {
          pendingAllyAttack?: unknown
          states: Set<number>
          stateTimers: Map<number, number>
          unitId: number
          areaId: number
        }
      >
      applyUnitState: (
        states: Set<number>,
        timers: Map<number, number>,
        unitType: 'player' | 'monster',
        unitId: number,
        areaId: number,
        stateId: number,
        durationFrames: number,
      ) => void
    }
    const record = internal.monsters.get(monsterId)!
    record.pendingAllyAttack = {
      targetKind: 'merc',
      targetId: 1,
      frame: game.frame + 3,
      mode: 4,
      skillMode: 'A1',
      minDmg: 10,
      maxDmg: 10,
    }
    // Direct applyUnitState (as used by War Cry / Mind Blast stun 21) clears pendingAllyAttack
    internal.applyUnitState(
      record.states,
      record.stateTimers,
      'monster',
      record.unitId,
      record.areaId,
      21,
      50,
    )
    expect(record.pendingAllyAttack).toBeUndefined()
    void playerId
  })

  it('applies knockback (2-3 sub-tiles) from Molten Boulder (229) and item_knock (81), and applies item_preventheal (117)', () => {
    const game = new GameInstance({ seed: 1346, areaId: 1 })
    const playerId = connect(game)
    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 12,
      y: 10,
      areaId: 1,
      maxHp: 5000,
      hp: 4000,
      damageRegen: 100,
    })
    const before = game.getMonsterState(monsterId)!
    // Molten Boulder (229) is in MONSTER_KNOCKBACK_SKILLS
    for (let i = 0; i < 10 && game.getMonsterState(monsterId)!.x <= before.x; i++) {
      game.applyDamageToMonster(monsterId, 10, playerId, 229)
    }
    const afterBoulder = game.getMonsterState(monsterId)!
    const dist = Math.hypot(afterBoulder.x - before.x, afterBoulder.y - before.y)
    expect(dist).toBeGreaterThanOrEqual(2 - 1e-6)
    expect(dist).toBeLessThanOrEqual(3 + 1e-6)

    // Equip attacker with item_preventheal (117) and item_knock (81)
    const internalPlayers = (
      game as unknown as {
        players: Map<number, { items: Array<Record<string, unknown>> }>
      }
    ).players
    internalPlayers.get(playerId)!.items.push({
      id: 9001,
      code: 'rng',
      name: 'Knock PMH Ring',
      location: 'equipped',
      bodyLoc: 6,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      quality: 'magic',
      identified: true,
      ethereal: false,
      sockets: 0,
      socketedItems: [],
      stats: new Map<number, number>([
        [81, 1],
        [117, 1],
      ]),
      statLines: [],
    })

    const beforeEquipHit = game.getMonsterState(monsterId)!
    for (let i = 0; i < 10 && game.getMonsterState(monsterId)!.x <= beforeEquipHit.x; i++) {
      game.applyDamageToMonster(monsterId, 10, playerId, 0)
    }
    const afterEquipHit = game.getMonsterState(monsterId)!
    expect(afterEquipHit.x).toBeGreaterThan(beforeEquipHit.x)
    expect(afterEquipHit.states.has(52)).toBe(true)

    // Prevent Monster Heal (52) from item_preventheal suppresses subsequent DamageRegen
    const hpAfterHit = afterEquipHit.hp
    game.stepFrames(80)
    expect(game.getMonsterState(monsterId)!.hp).toBe(hpAfterHit)
  })
})
