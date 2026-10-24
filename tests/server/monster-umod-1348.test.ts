/**
 * Issue #1348 — MonUMod affix coverage: data-driven labels, 1.13c missiles and
 * resisted death explosions, melee affix effects, multishot and aura enchanted.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { MONUMOD_113C_ROWS } from '../../src/common/units/monstats-113c-data.ts'
import { getMissileTxtData } from '../../src/common/skills/missiles-data.ts'

function connectPlayer(game: GameInstance, x: number, y: number, name = 'Target'): number {
  return game.connectPlayer({ charClass: 'bar', name, x, y, areaId: 1 })
}

function giveFireResist(game: GameInstance, playerId: number, resistPct: number): void {
  const player = (game as unknown as {
    players: Map<number, { items: unknown[] }>
  }).players.get(playerId)!
  player.items.push({
    location: 'equipped',
    stats: new Map([[39, resistPct]]),
  })
}

function missilesOfType(events: readonly { type: string }[], classId: number): number[] {
  return events
    .filter((e) => e.type === 'CreateMissile')
    .map((e) => (e as { missileClassId?: number }).missileClassId ?? -1)
    .filter((id) => id === classId)
}

describe('issue #1348 MonUMod affixes', () => {
  it('maps every enabled MonUMod row without aliasing #22 to Fire Enchanted', () => {
    const game = new GameInstance({ seed: 1348, areaId: 1 })
    connectPlayer(game, 80, 80)
    for (const row of MONUMOD_113C_ROWS) {
      if (!row.enabled) continue
      const id = game.spawnMonster({
        defId: 'fallen1',
        x: 30 + (row.umodId % 10),
        y: 30,
        areaId: 1,
        umodIds: [row.umodId],
        aiDisabled: true,
      })
      const modifiers = game.getMonsterState(id)!.modifiers
      expect(modifiers.length, `MonUMod ${row.umodId} (${row.id}) maps to a label`).toBeGreaterThan(0)
    }
    const quest = game.spawnMonster({ defId: 'fallen1', x: 60, y: 60, areaId: 1, umodIds: [22] })
    expect(game.getMonsterState(quest)!.modifiers).not.toContain('Fire_Enchanted')
    const fire = game.spawnMonster({ defId: 'fallen1', x: 62, y: 60, areaId: 1, umodIds: [9] })
    expect(game.getMonsterState(fire)!.modifiers).toContain('Fire_Enchanted')
  })

  it('Fire Enchanted death uses the 1.13c explosion, player fire resist and hits mercs', () => {
    const game = new GameInstance({ seed: 1349, areaId: 1, maxPlayers: 8 })
    const noResist = connectPlayer(game, 30, 31, 'NoResist')
    const resist = connectPlayer(game, 32, 31, 'WithResist')
    giveFireResist(game, resist, 75)
    const mercId = game.hireMercenary(noResist, { x: 31, y: 30, hp: 500, maxHp: 500 })
    const mercBefore = (game as unknown as {
      mercenaries: Map<number, { hp: number }>
    }).mercenaries.get(mercId)!.hp
    const monster = game.spawnMonster({
      defId: 'fallen1',
      x: 30,
      y: 30,
      areaId: 1,
      maxHp: 100,
      hp: 100,
      rank: 'unique',
      umodIds: [9],
    })
    const noResistBefore = game.getPlayerState(noResist)!.hp
    const resistBefore = game.getPlayerState(resist)!.hp
    game.drainEvents(noResist)
    game.applyDamageToMonster(monster, 1000, noResist)
    game.stepFrames(6)

    expect(game.getPlayerState(noResist)!.hp).toBeLessThan(noResistBefore)
    const noResistLoss = noResistBefore - game.getPlayerState(noResist)!.hp
    const resistLoss = resistBefore - game.getPlayerState(resist)!.hp
    expect(resistLoss).toBeGreaterThan(0)
    expect(resistLoss).toBeLessThan(noResistLoss)
    expect((game as unknown as {
      mercenaries: Map<number, { hp: number }>
    }).mercenaries.get(mercId)!.hp).toBeLessThan(mercBefore)
    expect(missilesOfType(game.drainEvents(noResist), 82).length).toBe(1)
  })

  it('Cold Enchanted nova uses coldunique and chills with state 11, never 28', () => {
    const game = new GameInstance({ seed: 1350, areaId: 1 })
    const playerId = connectPlayer(game, 30, 31)
    const monster = game.spawnMonster({
      defId: 'fallen1',
      x: 30,
      y: 30,
      areaId: 1,
      maxHp: 100,
      hp: 100,
      rank: 'unique',
      umodIds: [18],
    })
    game.drainEvents(playerId)
    game.applyDamageToMonster(monster, 1000, playerId)
    expect(missilesOfType(game.drainEvents(playerId), 194).length).toBe(64)
    game.stepFrames(3)
    const state = game.getPlayerState(playerId)!
    expect(state.states.has(11)).toBe(true)
    expect(state.states.has(28)).toBe(false)
  })

  it('Lightning Enchanted uses lightunique and is not triggered by a name match', () => {
    const game = new GameInstance({ seed: 1351, areaId: 1 })
    const playerId = connectPlayer(game, 30, 31)
    const enchanted = game.spawnMonster({
      defId: 'fallen1',
      x: 30,
      y: 30,
      areaId: 1,
      maxHp: 500,
      hp: 500,
      minDmg: 30,
      maxDmg: 30,
      rank: 'unique',
      umodIds: [17],
    })
    const named = game.spawnMonster({
      defId: 'fallen1',
      name: 'Lightning Beetle',
      x: 40,
      y: 30,
      areaId: 1,
      maxHp: 500,
      hp: 500,
    })
    game.drainEvents(playerId)
    game.applyDamageToMonster(enchanted, 1, playerId)
    const boltDmg = missilesOfType(game.drainEvents(playerId), 195)
    expect(boltDmg.length).toBe(8)

    game.applyDamageToMonster(named, 1, playerId)
    expect(missilesOfType(game.drainEvents(playerId), 195).length).toBe(0)
  })

  it('Multiple Shots fires three bolts and Cursed / Mana Burn apply on hit', () => {
    const game = new GameInstance({ seed: 1352, areaId: 1, maxPlayers: 8 })
    const playerId = connectPlayer(game, 38, 30)
    const shooter = game.spawnMonster({
      hcIdx: 160,
      defId: 'cr_archer1',
      x: 30,
      y: 30,
      areaId: 1,
      isRanged: true,
      rank: 'unique',
      umodIds: [29],
      aiDelay: 1,
      maxHp: 500,
      hp: 500,
    })
    game.drainEvents(playerId)
    game.stepFrames(1)
    const shots = missilesOfType(game.drainEvents(playerId), getMissileTxtData('cr_arrow1').id)
    expect(shots.length).toBe(3)

    const cursed = game.spawnMonster({
      defId: 'fallen1',
      x: 30,
      y: 40,
      areaId: 1,
      rank: 'unique',
      umodIds: [7, 25],
      minDmg: 20,
      maxDmg: 20,
      ar: 100000,
      aiDelay: 1,
      maxHp: 5000,
      hp: 5000,
    })
    const meleePlayer = connectPlayer(game, 31, 40, 'MeleeTarget')
    game.drainEvents(meleePlayer)
    const manaBefore = game.getPlayerState(meleePlayer)!.mana
    game.stepFrames(20)
    const after = game.getPlayerState(meleePlayer)!
    expect(after.states.has(9)).toBe(true)
    expect(after.mana).toBeLessThan(manaBefore)
    void shooter
    void cursed
  })

  it('Aura Enchanted assigns a real aura and applies Holy Freeze / Conviction', () => {
    const game = new GameInstance({ seed: 1353, areaId: 1 })
    const playerId = connectPlayer(game, 30, 31)
    // hcIdx 19 + area 1 + seed; seed 0 -> index 2 (Holy Freeze 114),
    // seed 3 -> index 5 (Conviction 123).
    const freeze = game.spawnMonster({
      defId: 'fallen1',
      x: 30,
      y: 30,
      areaId: 1,
      rank: 'unique',
      umodIds: [30],
      statSeed: 0,
      aiDelay: 1,
      maxHp: 5000,
      hp: 5000,
    })
    const conviction = game.spawnMonster({
      defId: 'fallen1',
      x: 32,
      y: 30,
      areaId: 1,
      rank: 'unique',
      umodIds: [30],
      statSeed: 3,
      aiDelay: 1,
      maxHp: 5000,
      hp: 5000,
    })
    const monsters = (game as unknown as {
      monsters: Map<number, { auraSkillId?: number }>
    }).monsters
    expect(monsters.get(freeze)!.auraSkillId).toBe(114)
    expect(monsters.get(conviction)!.auraSkillId).toBe(123)
    game.stepFrames(25)
    const state = game.getPlayerState(playerId)!
    expect(state.states.has(11)).toBe(true)
    expect(state.states.has(28)).toBe(true)
  })
})