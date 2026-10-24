/**
 * Issue #1339: 1.13c level-difference experience modifier and party split.
 *
 * `EXP_ComputeLevelDiffPenalty` 0x6FC9CE80, `EXP_DivideExperience` 0x6FC9D260.
 */
import { describe, expect, it } from 'vitest'
import {
  LEVEL_DIFF_EXP_MOD_UNDER25,
  computeMonsterExpGrant113c,
  partyExpPool113c,
  partyExpShare113c,
} from '../../src/common/progression/experience-113c.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

type AnyRecord = Record<string, any>

function internal(game: GameInstance): AnyRecord {
  return game as unknown as AnyRecord
}

describe('#1339 level-difference experience', () => {
  it('uses the under-25 table and the clvl/mlvl rule', () => {
    expect(LEVEL_DIFF_EXP_MOD_UNDER25).toHaveLength(11)
    expect(computeMonsterExpGrant113c(1000, 10, 10)).toBe(1000)
    expect(computeMonsterExpGrant113c(1000, 10, 16)).toBe(Math.floor((1000 * 207) / 256))
    expect(computeMonsterExpGrant113c(1000, 10, 20)).toBe(Math.floor((1000 * 13) / 256))
    expect(computeMonsterExpGrant113c(1000, 30, 40)).toBe(750)
    expect(computeMonsterExpGrant113c(1000, 40, 30)).toBe(Math.floor((1000 * 13) / 256))
    expect(computeMonsterExpGrant113c(1000, 40, 35)).toBe(1000)
  })

  it('applies the party pool and level-weighted share', () => {
    expect(partyExpPool113c(1000, 1)).toBe(1000)
    expect(partyExpPool113c(1000, 2)).toBe(1000 + Math.floor((1000 * 89) / 256))
    expect(partyExpPool113c(1000, 3)).toBe(1000 + Math.floor((1000 * 89 * 2) / 256))
    expect(partyExpShare113c(1347, 20, 50)).toBe(538)
  })

  it('grants level-adjusted and party-weighted XP on a kill', () => {
    const game = new GameInstance({ seed: 13390, areaId: 1, maxPlayers: 2 })
    game.setPlayersX(1)
    const lowId = game.connectPlayer({ charClass: 'pal', name: 'Low', x: 10, y: 10, areaId: 1 })
    const highId = game.connectPlayer({ charClass: 'pal', name: 'High', x: 12, y: 10, areaId: 1 })
    const g = internal(game)
    const low = g.players.get(lowId) as AnyRecord
    const high = g.players.get(highId) as AnyRecord
    low.level = 20
    high.level = 30
    low.partyId = 1
    high.partyId = 1
    low.experience = 0
    high.experience = 0
    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 11,
      y: 10,
      areaId: 1,
      hp: 1,
      maxHp: 1,
      experience: 1000,
    })
    const monster = g.monsters.get(monsterId) as AnyRecord
    monster.level = 40
    g.onMonsterKilled(low, monster)

    // playersX=2 -> base 1500; pool 2021; shares 808/1212.
    expect(low.experience).toBe(Math.floor((808 * 13) / 256))
    expect(high.experience).toBe(Math.floor((1212 * 30) / 40))
  })

  it('excludes same-party members outside the two-screen radius', () => {
    const game = new GameInstance({ seed: 13391, areaId: 1, maxPlayers: 2 })
    game.setPlayersX(1)
    const killerId = game.connectPlayer({ charClass: 'pal', name: 'Killer', x: 10, y: 10, areaId: 1 })
    const farId = game.connectPlayer({ charClass: 'pal', name: 'Far', x: 80, y: 10, areaId: 1 })
    const g = internal(game)
    const killer = g.players.get(killerId) as AnyRecord
    const far = g.players.get(farId) as AnyRecord
    killer.partyId = 1
    far.partyId = 1
    killer.level = 20
    far.level = 20
    killer.experience = 0
    far.experience = 0
    const monsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 11,
      y: 10,
      areaId: 1,
      hp: 1,
      maxHp: 1,
      experience: 1000,
    })
    const monster = g.monsters.get(monsterId) as AnyRecord
    monster.level = 20
    g.onMonsterKilled(killer, monster)
    // playersX=2 -> base 1500, no party pool (one recipient).
    expect(killer.experience).toBe(1500)
    expect(far.experience).toBe(0)
  })

  it('applies the Experience Shrine and item_addexperience bonuses', () => {
    const game = new GameInstance({ seed: 13392, areaId: 1 })
    const id = game.connectPlayer({ charClass: 'pal', name: 'Bonus', x: 10, y: 10, areaId: 1 })
    const player = internal(game).players.get(id) as AnyRecord
    player.level = 20
    player.experience = 0
    player.states.add(137)
    player.items.push({
      location: 'equipped',
      stats: new Map([[85, 50]]),
      socketedItems: [],
    })
    internal(game).grantExperience(player, 1000, 20)
    // 1000 * 1.5 shrine * 1.5 item = 2250
    expect(player.experience).toBe(2250)
  })
})