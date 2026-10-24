/**
 * Issue #1341 — shared MonAi profile table and per-row state machines.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { MONAI_113C_ROWS } from '../../src/common/units/monstats-113c-data.ts'
import {
  MONAI_PROFILES_113C,
  monaiProfile113c,
  normalizeMonAiName113c,
} from '../../src/common/units/monai-113c.ts'

interface InternalMonster {
  hp: number
  maxHp: number
  cooldown: number
  spawnedChildren: number
  frenzyUntilFrame: number
  threatPlayerId: number
}

function internalMonster(game: GameInstance, unitId: number): InternalMonster {
  const monsters = (game as unknown as { monsters: Map<number, InternalMonster> }).monsters
  const monster = monsters.get(unitId)
  if (monster === undefined) throw new Error(`monster ${String(unitId)} not found`)
  return monster
}

describe('issue #1341 shared MonAi profile table', () => {
  it('defines exactly one profile for each MonAi.txt row', () => {
    expect(Object.keys(MONAI_PROFILES_113C)).toHaveLength(148)
    for (const row of MONAI_113C_ROWS) {
      const profile = monaiProfile113c(row.ai)
      expect(profile.index).toBe(row.index)
      expect(profile.name).toBe(row.ai)
      expect(normalizeMonAiName113c(profile.name)).toBe(normalizeMonAiName113c(row.ai))
    }
  })

  it('keeps every aip slot inside aip1..aip8', () => {
    for (const profile of Object.values(MONAI_PROFILES_113C)) {
      const slots = [
        profile.shootDistanceParam,
        profile.kiteDistanceParam,
        profile.woundedTargetParam,
        profile.healRangeParam,
        profile.charge?.delayParam,
        profile.leap?.delayParam,
        profile.hurtRetreat?.hurtParam,
        profile.hurtRetreat?.distanceParam,
        profile.spawn?.maxParam,
        profile.spawn?.batchParam,
        profile.spawn?.intervalParam,
        profile.fireGate?.hurtParam,
        profile.fireGate?.healthyChanceParam,
        profile.fireGate?.hurtChanceParam,
        profile.frenzy?.thresholdParam,
        profile.frenzy?.speedParam,
        profile.frenzy?.consecutiveParam,
      ].filter((value): value is number => value !== undefined)
      for (const slot of slots) {
        expect(slot, `${profile.name} aip slot`).toBeGreaterThanOrEqual(0)
        expect(slot, `${profile.name} aip slot`).toBeLessThanOrEqual(7)
      }
    }
  })

  it('no longer treats Overseer and HighPriest as corpse resurrectors', () => {
    expect(monaiProfile113c('Overseer').resurrect).toBe(false)
    expect(monaiProfile113c('Overseer').whip).toBe(true)
    expect(monaiProfile113c('HighPriest').resurrect).toBe(false)
    expect(monaiProfile113c('HighPriest').healRangeParam).toBe(5)
    expect(monaiProfile113c('FallenShaman').resurrect).toBe(true)
    expect(monaiProfile113c('GreaterMummy').resurrect).toBe(true)
    expect(monaiProfile113c('FetishShaman').resurrect).toBe(true)
  })

  it('throws for an unknown AI instead of silently falling back to melee', () => {
    expect(() => monaiProfile113c('NotAnAiRow')).toThrow(/not present in MonAi.txt/)
  })
})

describe('issue #1341 per-row state machines', () => {
  it('caps SandMaggot eggs at aip1 and spawns the aip3 batch', () => {
    const game = new GameInstance({ seed: 134101, areaId: 1 })
    game.connectPlayer({ charClass: 'bar', name: 'Target', x: 10, y: 10, areaId: 1 })
    const maggot = game.spawnMonster({ defId: 'sandmaggot1', x: 16, y: 10, areaId: 1 })
    game.stepFrames(240)
    const eggs = [...(game as unknown as { monsters: Map<number, { defId: string }> }).monsters.values()]
      .filter((monster) => monster.defId === 'maggotegg1')
    // SandMaggot row 15: aip3 = number of eggs per lay (2).
    expect(eggs.length).toBeGreaterThan(0)
    expect(eggs.length).toBeLessThanOrEqual(2)
    expect(internalMonster(game, maggot).spawnedChildren).toBeLessThanOrEqual(2)
  })

  it('caps VileMother children at aip1', () => {
    const game = new GameInstance({ seed: 134102, areaId: 1 })
    game.connectPlayer({ charClass: 'bar', name: 'Target', x: 10, y: 10, areaId: 1 })
    const mother = game.spawnMonster({ defId: 'vilemother1', x: 15, y: 10, areaId: 1, hp: 500, maxHp: 500 })
    game.stepFrames(500)
    const dogs = [...(game as unknown as { monsters: Map<number, { defId: string }> }).monsters.values()]
      .filter((monster) => monster.defId === 'viledog1')
    expect(dogs.length).toBeGreaterThan(0)
    expect(dogs.length).toBeLessThanOrEqual(16)
    expect(internalMonster(game, mother).spawnedChildren).toBeLessThanOrEqual(16)
  })

  it('gives BloodHawk and SandLeaper a faster burst than a normal walk', () => {
    const crowGame = new GameInstance({ seed: 134103, areaId: 1 })
    crowGame.connectPlayer({ charClass: 'bar', name: 'Target', x: 10, y: 10, areaId: 1 })
    const crow = crowGame.spawnMonster({ defId: 'foulcrow1', x: 20, y: 10, areaId: 1 })
    crowGame.stepFrames(1)

    const zombieGame = new GameInstance({ seed: 134103, areaId: 1 })
    zombieGame.connectPlayer({ charClass: 'bar', name: 'Target', x: 10, y: 10, areaId: 1 })
    const zombie = zombieGame.spawnMonster({ defId: 'zombie1', x: 20, y: 10, areaId: 1 })
    zombieGame.stepFrames(1)

    expect(20 - crowGame.getMonsterState(crow)!.x).toBeGreaterThan(
      20 - zombieGame.getMonsterState(zombie)!.x,
    )

    const leapGame = new GameInstance({ seed: 134104, areaId: 1 })
    leapGame.connectPlayer({ charClass: 'bar', name: 'Target', x: 10, y: 10, areaId: 1 })
    const leaper = leapGame.spawnMonster({ defId: 'sandleaper1', x: 20, y: 10, areaId: 1 })
    leapGame.stepFrames(1)
    expect(20 - leapGame.getMonsterState(leaper)!.x).toBeGreaterThan(
      20 - zombieGame.getMonsterState(zombie)!.x,
    )
  })

  it('applies profile drain on melee hits (BatDemon life, Swarm stamina)', () => {
    const life = new GameInstance({ seed: 134105, areaId: 1 })
    life.connectPlayer({ charClass: 'bar', name: 'Target', x: 10, y: 10, areaId: 1, hp: 500, maxHp: 500 })
    const bat = life.spawnMonster({ defId: 'batdemon1', x: 11, y: 10, areaId: 1, hp: 50, maxHp: 100 })
    life.stepFrames(20)
    expect(internalMonster(life, bat).hp).toBeGreaterThan(50)

    const stamina = new GameInstance({ seed: 134106, areaId: 1 })
    const player = stamina.connectPlayer({ charClass: 'bar', name: 'Target', x: 10, y: 10, areaId: 1 })
    stamina.spawnMonster({ defId: 'swarm1', x: 11, y: 10, areaId: 1 })
    const before = stamina.getPlayerState(player)!.stamina
    // Check right after the first `aidel`-gated swing, before stamina regen refills it.
    stamina.stepFrames(10)
    expect(stamina.getPlayerState(player)!.stamina).toBeLessThan(before)
  })

  it('prefers a wounded player for Vulture (aip3 wounded %)', () => {
    const game = new GameInstance({ seed: 134107, areaId: 1, maxPlayers: 2 })
    game.connectPlayer({ charClass: 'bar', name: 'Healthy', x: 16, y: 10, areaId: 1, hp: 500, maxHp: 500 })
    game.connectPlayer({ charClass: 'bar', name: 'Wounded', x: 14, y: 14, areaId: 1, hp: 100, maxHp: 500 })
    game.spawnMonster({ defId: 'vulture1', x: 20, y: 10, areaId: 1 })
    game.stepFrames(4)
    const vulture = [...(game as unknown as { monsters: Map<number, { defId: string; y: number }> }).monsters.values()]
      .find((monster) => monster.defId === 'vulture1')!
    expect(vulture.y).toBeGreaterThan(10)
  })

  it('triggers ThornHulk frenzy after consecutive A2 swings (aip4/aip6)', () => {
    const game = new GameInstance({ seed: 134110, areaId: 1 })
    game.connectPlayer({ charClass: 'bar', name: 'Target', x: 10, y: 10, areaId: 1, hp: 10000, maxHp: 10000 })
    const hulk = game.spawnMonster({
      defId: 'thornhulk1',
      x: 11,
      y: 10,
      areaId: 1,
      hp: 5000,
      maxHp: 5000,
      // aip4 = 100% frenzy chance, aip5 = +5% speed, aip6 = one A2 swing,
      // aip2 = 100% A2 selection so the `aidel` think cadence still reaches it.
      aiParams: [80, 100, 10, 100, 5, 1, 0, 0],
    })
    game.stepFrames(120)
    expect(internalMonster(game, hulk).frenzyUntilFrame).toBeGreaterThan(0)
  })

  it('makes HighPriest heal the most wounded ally within aip6', () => {
    const game = new GameInstance({ seed: 134108, areaId: 2 })
    game.connectPlayer({ charClass: 'bar', name: 'Target', x: 12, y: 12, areaId: 2 })
    const priest = game.spawnMonster({ defId: 'councilmember1', x: 10, y: 10, areaId: 2 })
    const ally = game.spawnMonster({ defId: 'skeleton1', x: 10, y: 11, areaId: 2, hp: 10, maxHp: 100 })
    game.stepFrames(20)
    expect(internalMonster(game, ally).hp).toBeGreaterThan(10)
    expect(internalMonster(game, priest).hp).toBeLessThanOrEqual(1000)
  })

  it('makes Overseer Cry Help pull nearby allies onto the player', () => {
    const game = new GameInstance({ seed: 134109, areaId: 2 })
    const player = game.connectPlayer({ charClass: 'bar', name: 'Target', x: 15, y: 10, areaId: 2 })
    const overseer = game.spawnMonster({ defId: 'overseer1', x: 10, y: 10, areaId: 2 })
    const ally = game.spawnMonster({ defId: 'skeleton1', x: 12, y: 10, areaId: 2 })
    const internal = game as unknown as {
      monsters: Map<number, InternalMonster & { skills: readonly { skillId?: number }[] }>
      tryCastMonsterUtilitySkill: (
        monster: unknown,
        target: { x: number; y: number },
        distance: number,
      ) => boolean
    }
    const record = internal.monsters.get(overseer)!
    record.skills = [{ skillId: 290 }]
    internal.tryCastMonsterUtilitySkill(record, { x: 15, y: 10 }, 5)
    expect(internal.monsters.get(ally)!.threatPlayerId).toBe(player)
  })
})