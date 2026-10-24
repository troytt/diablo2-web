/**
 * Issue #1344 — complete melee parity: action-frame damage, A2/S1 selection,
 * MonStats elemental riders and player block stats.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

interface MonsterRecord {
  mode: number
  pendingAttack?: { frame: number; mode: number; skillMode: string; minDmg: number; maxDmg: number }
  hasAttack2: boolean
  attack2MinDmg: number
  attack2MaxDmg: number
  elementalAttacks: unknown[]
}

function setup(seed: number): {
  game: GameInstance
  playerId: number
  monsterId: number
  player: { hp: number; hpFixed: number; items: unknown[] }
  monster: MonsterRecord
} {
  const game = new GameInstance({ seed, areaId: 1 })
  const playerId = game.connectPlayer({ charClass: 'pal', name: 'Target', x: 10, y: 10, areaId: 1 })
  const player = (game as unknown as {
    players: Map<number, { hp: number; hpFixed: number; items: unknown[] }>
  }).players.get(playerId)!
  const monsterId = game.spawnMonster({
    defId: 'fallen1',
    x: 11,
    y: 10,
    areaId: 1,
    minDmg: 10,
    maxDmg: 10,
    ar: 100000,
  })
  const monster = (game as unknown as { monsters: Map<number, MonsterRecord> }).monsters.get(monsterId)!
  return { game, playerId, monsterId, player, monster }
}

describe('issue #1344 melee attack completeness', () => {
  it('broadcasts the mode first and applies damage on the action frame', () => {
    const { game, playerId, player, monster } = setup(1344)
    ;(game as unknown as { rng: { rand: (n: number) => number } }).rng.rand = () => 50
    const hpBefore = player.hp
    game.drainEvents(playerId)
    game.stepFrames(1)
    expect(monster.pendingAttack).toBeDefined()
    expect([4, 5]).toContain(monster.mode)
    expect(player.hp).toBe(hpBefore)
    game.stepFrames(20)
    expect(player.hp).toBeLessThan(hpBefore)
  })

  it('selects A2 (mode 5) when the monster has an attack2 and the roll picks it', () => {
    const { game, monster } = setup(1345)
    monster.hasAttack2 = true
    monster.attack2MinDmg = 20
    monster.attack2MaxDmg = 20
    ;(game as unknown as { rng: { rand: (n: number) => number } }).rng.rand = () => 0
    game.stepFrames(1)
    expect(monster.mode).toBe(5)
    expect(monster.pendingAttack?.skillMode).toBe('A2')
  })

  it('adds MonStats elemental damage to the melee hit', () => {
    const plain = setup(1346)
    const elemental = setup(1346)
    plain.game.drainEvents(plain.playerId)
    elemental.game.drainEvents(elemental.playerId)
    elemental.monster.elementalAttacks = [
      { mode: 'A1', type: 'fire', chancePct: 100, minDamage: 30, maxDamage: 30, durationFrames: 0 },
    ]
    const plainHp = plain.player.hp
    const elementalHp = elemental.player.hp
    for (const ctx of [plain, elemental]) {
      ;(ctx.game as unknown as { rng: { rand: (n: number) => number } }).rng.rand = () => 50
      ctx.game.stepFrames(20)
    }
    expect(plainHp - plain.player.hp).toBeGreaterThan(0)
    expect(elementalHp - elemental.player.hp).toBeGreaterThan(plainHp - plain.player.hp)
  })

  it('never rolls A2 (mode 5) when hasAttack2 is false even if aip2 > 0 (e.g. foulcrow1)', () => {
    const game = new GameInstance({ seed: 1347, areaId: 1 })
    game.connectPlayer({ charClass: 'pal', name: 'Target', x: 10, y: 10, areaId: 1 })
    const crowId = game.spawnMonster({
      defId: 'foulcrow1',
      x: 11,
      y: 10,
      areaId: 1,
      ar: 100000,
    })
    const crow = (
      game as unknown as {
        monsters: Map<
          number,
          MonsterRecord & { aiParams: readonly number[]; cooldownTicks: number; cooldown: number }
        >
      }
    ).monsters.get(crowId)!
    expect(crow.hasAttack2).toBe(false)
    expect(crow.aiParams[1]).toBe(90)
    ;(game as unknown as { rng: { rand: (n: number) => number } }).rng.rand = () => 0
    game.stepFrames(1)
    expect(crow.mode).toBe(4)
    expect(crow.pendingAttack?.skillMode).toBe('A1')
    expect(crow.cooldown).toBeGreaterThanOrEqual(crow.cooldownTicks)
  })

  it('scales melee minDmg/maxDmg and attack2/special1 for Extra Strong and Champion monsters', () => {
    const game = new GameInstance({ seed: 1348, areaId: 1 })
    const normalId = game.spawnMonster({ defId: 'skeleton1', x: 10, y: 10, areaId: 1 })
    const strongId = game.spawnMonster({
      defId: 'skeleton1',
      x: 12,
      y: 10,
      areaId: 1,
      monUMods: [5],
    })
    const champId = game.spawnMonster({
      defId: 'skeleton1',
      x: 14,
      y: 10,
      areaId: 1,
      rank: 'champion',
    })
    const monsters = (
      game as unknown as {
        monsters: Map<
          number,
          {
            minDmg: number
            maxDmg: number
            attack2MinDmg: number
            attack2MaxDmg: number
          }
        >
      }
    ).monsters
    const normal = monsters.get(normalId)!
    const strong = monsters.get(strongId)!
    const champ = monsters.get(champId)!
    expect(strong.maxDmg).toBe(Math.round(normal.maxDmg * 1.5))
    expect(strong.attack2MaxDmg).toBe(Math.round(normal.attack2MaxDmg * 1.5))
    expect(champ.maxDmg).toBe(Math.round(normal.maxDmg * 2))
    expect(champ.attack2MaxDmg).toBe(Math.round(normal.attack2MaxDmg * 2))
  })

  it('slows melee actionFrame and totalFrames when chilled or decrepified and speeds up under frenzy', () => {
    const { game, monster } = setup(1349)
    const internalGame = game as unknown as {
      currentFrame: number
      monsterAttackTiming: (
        m: unknown,
        mode: 'A1' | 'A2' | 'S1',
      ) => { actionFrame: number; totalFrames: number }
    }
    const baseTiming = internalGame.monsterAttackTiming(monster, 'A1')
    ;(monster as unknown as { states: Set<number> }).states.add(60) // Decrepify (-50%)
    const slowedTiming = internalGame.monsterAttackTiming(monster, 'A1')
    expect(slowedTiming.actionFrame).toBeGreaterThan(baseTiming.actionFrame)
    expect(slowedTiming.totalFrames).toBeGreaterThan(baseTiming.totalFrames)
    ;(monster as unknown as { states: Set<number> }).states.delete(60)
    ;(monster as unknown as { frenzyUntilFrame: number; frenzySpeedPct: number }).frenzyUntilFrame =
      internalGame.currentFrame + 100
    ;(monster as unknown as { frenzyUntilFrame: number; frenzySpeedPct: number }).frenzySpeedPct = 100
    const frenziedTiming = internalGame.monsterAttackTiming(monster, 'A1')
    expect(frenziedTiming.actionFrame).toBeLessThan(baseTiming.actionFrame)
    expect(frenziedTiming.totalFrames).toBeLessThan(baseTiming.totalFrames)
  })

  it('uses an independent RNG roll for player shield block instead of reusing the monster hit roll', () => {
    const { game, player } = setup(1350)
    // Equip a shield with 50% total block chance (bodyLoc = 5, stat 20 = 50).
    player.items.push({
      unitId: 999,
      code: 'buc',
      name: 'Buckler',
      quality: 2,
      level: 1,
      location: 'equipped',
      x: 0,
      y: 0,
      width: 2,
      height: 2,
      areaId: 1,
      ownerId: 1,
      bodyLoc: 5,
      storePage: 0,
      cost: 100,
      gamble: false,
      identified: true,
      ethereal: false,
      socketed: false,
      totalSockets: 0,
      durability: 10,
      maxDurability: 10,
      quantity: 1,
      stats: new Map([[20, 50]]),
      socketedItems: [],
    })
    // Sequence of rand(100) calls during stepFrames:
    // 1) beginMonsterMeleeAttack mode roll -> 50 (A1)
    // 2) resolveMonsterAttackOnPlayer hit roll100 -> 80 (< 95% hit chance, so hit succeeds, but >= 50% block if reused!)
    // 3) resolveMonsterAttackOnPlayer blockRoll100 -> 10 (< 50% block chance, so shield blocks!)
    const rolls = [50, 80, 10]
    let idx = 0
    ;(game as unknown as { rng: { rand: (n: number) => number } }).rng.rand = () =>
      rolls[idx++] ?? 10
    const hpBefore = player.hp
    game.stepFrames(20)
    expect(player.hp).toBe(hpBefore)
  })
})