/**
 * Follow-up gaps from the #1352 / #1358 implementation plans:
 * Assassin lock-picking does not consume a key, and Tyrael can revive a merc.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

type AnyRecord = Record<string, any>

function internal(game: GameInstance): AnyRecord {
  return game as unknown as AnyRecord
}

describe('reopened review pass 3', () => {
  it('#1352 Assassins pick locks without spending a key', () => {
    const assassinGame = new GameInstance({ seed: 3001, areaId: 1 })
    const assassinId = assassinGame.connectPlayer({
      charClass: 'asn',
      name: 'Assassin',
      x: 10,
      y: 10,
      areaId: 1,
    })
    const assassin = internal(assassinGame).players.get(assassinId) as AnyRecord
    expect(assassin.classId).toBe(6)
    expect(internal(assassinGame).consumeKey(assassin)).toBe(true)

    const barbGame = new GameInstance({ seed: 3002, areaId: 1 })
    const barbId = barbGame.connectPlayer({
      charClass: 'bar',
      name: 'Barb',
      x: 10,
      y: 10,
      areaId: 1,
    })
    const barb = internal(barbGame).players.get(barbId) as AnyRecord
    expect(internal(barbGame).consumeKey(barb)).toBe(false)
  })

  it('#1358 Tyrael resurrects a dead mercenary', () => {
    const game = new GameInstance({ seed: 3003, areaId: 1 })
    const playerId = game.connectPlayer({
      charClass: 'pal',
      name: 'Hero',
      x: 10,
      y: 10,
      areaId: 1,
    })
    const npcId = game.spawnMonster({
      hcIdx: 367,
      name: 'Tyrael',
      x: 11,
      y: 10,
      areaId: 1,
      isNpc: true,
    })
    const mercId = game.hireMercenary(playerId, { x: 10, y: 11, level: 5, hp: 100, maxHp: 100 })
    const g = internal(game)
    const player = g.players.get(playerId) as AnyRecord
    const merc = g.mercenaries.get(mercId) as AnyRecord
    player.gold = 10_000
    merc.alive = false
    merc.hp = 0
    g.handleMercResurrect(player, npcId)
    expect(merc.alive).toBe(true)
    expect(merc.hp).toBe(merc.maxHp)
  })
})