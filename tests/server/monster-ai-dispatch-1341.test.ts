/**
 * Issue #1341 — MonAi-driven dispatch, not display-name heuristics.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { MONSTER_AI_BEHAVIOR_BY_AI } from '../../src/server/engine/game-instance.ts'
import { MONAI_113C_ROWS } from '../../src/common/units/monstats-113c-data.ts'
import { getMissileTxtData } from '../../src/common/skills/missiles-data.ts'

function missileEvents(
  events: readonly { type: string }[],
): readonly { missileClassId?: number; skillId?: number }[] {
  return events.filter((e) => e.type === 'CreateMissile') as readonly {
    missileClassId?: number
    skillId?: number
  }[]
}

function normalize(ai: string): string {
  return ai.trim().toLowerCase().replace(/[\s_-]/g, '')
}

describe('issue #1341 MonAi dispatch', () => {
  it('assigns every MonAi.txt row to an explicit behavior family', () => {
    expect(MONAI_113C_ROWS).toHaveLength(148)
    for (const row of MONAI_113C_ROWS) {
      expect(
        MONSTER_AI_BEHAVIOR_BY_AI[normalize(row.ai)],
        `MonAi row ${String(row.index)} (${row.ai}) has no behavior`,
      ).toBeDefined()
    }
    expect(Object.keys(MONSTER_AI_BEHAVIOR_BY_AI)).toHaveLength(148)
  })

  it('does not classify hcIdx 5 (zombie1) as ranged, and keeps a real archer ranged', () => {
    const game = new GameInstance({ seed: 1341, areaId: 2 })
    game.connectPlayer({ charClass: 'bar', name: 'Target', x: 10, y: 10, areaId: 2 })
    const zombie = game.spawnMonster({ hcIdx: 5, defId: 'zombie1', x: 12, y: 10, areaId: 2 })
    const archer = game.spawnMonster({ hcIdx: 160, defId: 'cr_archer1', x: 16, y: 10, areaId: 2 })
    expect(game.getMonster(zombie)!.isRanged).toBe(false)
    expect(game.getMonster(archer)!.isRanged).toBe(true)
  })

  it('detonates a SuicideMinion on contact', () => {
    const game = new GameInstance({ seed: 1347, areaId: 2 })
    const playerId = game.connectPlayer({ charClass: 'bar', name: 'Target', x: 10, y: 10, areaId: 2, hp: 500, maxHp: 500 })
    const minion = game.spawnMonster({ hcIdx: 461, defId: 'suicideminion1', x: 11, y: 10, areaId: 2, hp: 20, maxHp: 20 })
    game.stepFrames(2)
    expect(game.getMonsterState(minion)!.dead).toBe(true)
    expect(game.getPlayerState(playerId)!.hp).toBeLessThan(500)
  })

  it('spawns VileDog children from a VileMother', () => {
    const game = new GameInstance({ seed: 1348, areaId: 1 })
    game.connectPlayer({ charClass: 'bar', name: 'Target', x: 10, y: 10, areaId: 1 })
    const mother = game.spawnMonster({ defId: 'vilemother1', x: 15, y: 10, areaId: 1, hp: 500, maxHp: 500 })
    const before = (game as unknown as { monsters: Map<number, unknown> }).monsters.size
    game.stepFrames(140)
    const monsters = (game as unknown as { monsters: Map<number, { defId: string }> }).monsters
    expect(monsters.size).toBeGreaterThan(before)
    expect([...monsters.values()].some((m) => m.defId === 'viledog1')).toBe(true)
    expect(game.getMonster(mother)).toBeDefined()
  })

  it('gives SandRaider a charge burst and makes archers kite', () => {
    const charge = new GameInstance({ seed: 1349, areaId: 1 })
    charge.connectPlayer({ charClass: 'bar', name: 'Target', x: 10, y: 10, areaId: 1 })
    const raider = charge.spawnMonster({ defId: 'sandraider1', x: 20, y: 10, areaId: 1 })
    charge.stepFrames(1)
    expect(charge.getMonsterState(raider)!.x).toBeLessThan(20)

    const kite = new GameInstance({ seed: 1350, areaId: 1 })
    kite.connectPlayer({ charClass: 'bar', name: 'Target', x: 10, y: 10, areaId: 1 })
    const archer = kite.spawnMonster({ hcIdx: 160, defId: 'cr_archer1', x: 13, y: 10, areaId: 1 })
    kite.stepFrames(3)
    expect(kite.getMonsterState(archer)!.x).toBeGreaterThan(13)
  })

  it('keeps stationary AI rows (MaggotEgg) at their spawn anchor', () => {
    const game = new GameInstance({ seed: 1342, areaId: 2 })
    game.connectPlayer({ charClass: 'bar', name: 'Target', x: 15, y: 10, areaId: 2 })
    const egg = game.spawnMonster({ hcIdx: 190, defId: 'maggotegg1', x: 10, y: 10, areaId: 2 })
    game.stepFrames(40)
    const state = game.getMonster(egg)!
    expect(state.x).toBe(10)
    expect(state.y).toBe(10)
  })

  it('gates Bighead A2 lightning on aip1 hurt % and aip3/aip4', () => {
    const boltId = getMissileTxtData('bighead1').id
    const healthy = new GameInstance({ seed: 13411, areaId: 2 })
    const healthyPlayer = healthy.connectPlayer({
      charClass: 'bar',
      name: 'Target',
      x: 10,
      y: 10,
      areaId: 2,
      hp: 500,
      maxHp: 500,
    })
    // bighead1: aip1=88 (hurt %), aip3=0 (never fire while healthy), aip4=60.
    healthy.spawnMonster({ hcIdx: 10, defId: 'bighead1', x: 22, y: 10, areaId: 2, hp: 100, maxHp: 100 })
    healthy.drainEvents(healthyPlayer)
    healthy.stepFrames(40)
    expect(
      missileEvents(healthy.drainEvents(healthyPlayer)).some((e) => e.missileClassId === boltId),
    ).toBe(false)

    const hurt = new GameInstance({ seed: 13412, areaId: 2 })
    const hurtPlayer = hurt.connectPlayer({
      charClass: 'bar',
      name: 'Target',
      x: 10,
      y: 10,
      areaId: 2,
      hp: 500,
      maxHp: 500,
    })
    hurt.spawnMonster({ hcIdx: 10, defId: 'bighead1', x: 22, y: 10, areaId: 2, hp: 40, maxHp: 100 })
    hurt.drainEvents(hurtPlayer)
    hurt.stepFrames(120)
    expect(
      missileEvents(hurt.drainEvents(hurtPlayer)).some((e) => e.missileClassId === boltId),
    ).toBe(true)
  })

  it('makes a wounded Arach retreat to its aip4 run distance', () => {
    const game = new GameInstance({ seed: 13413, areaId: 1 })
    game.connectPlayer({ charClass: 'bar', name: 'Target', x: 10, y: 10, areaId: 1 })
    // arach1: aip4=8 (run dist), aip5=25 (hurt %).
    const arach = game.spawnMonster({ hcIdx: 122, defId: 'arach1', x: 14, y: 10, areaId: 1, hp: 20, maxHp: 100 })
    game.stepFrames(3)
    expect(game.getMonsterState(arach)!.x).toBeGreaterThan(14)
  })

  it('keeps Succubus curses active after the kiter family override', () => {
    const game = new GameInstance({ seed: 13414, areaId: 2 })
    const playerId = game.connectPlayer({ charClass: 'bar', name: 'Target', x: 10, y: 10, areaId: 2 })
    // aip3=curse?, aip7=curse level. Distance 10 keeps it outside the kiting band.
    game.spawnMonster({ hcIdx: 469, defId: 'succubus1', x: 20, y: 10, areaId: 2 })
    game.drainEvents(playerId)
    game.stepFrames(90)
    const states = game.getPlayerState(playerId)!.states
    expect([60, 9, 61, 58, 19].some((id) => states.has(id))).toBe(true)
  })
})