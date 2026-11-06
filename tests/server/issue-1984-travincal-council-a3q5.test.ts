import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  QUEST_FLAG_COMPLETED_113C,
  hasQuestFlag113c,
  setQuestFlag113c,
} from '../../src/server/engine/quests-113c.ts'

describe('Issue #1984: 1.13c Act 3 a3q5 Travincal Council (Area 83) completion & drops', () => {
  it('completes a3q5 and drops qf1 on 1st kill + backup box on 2nd kill in DRLG Travincal (Area 83) with only councilmember1 & councilmember2', () => {
    const game = new GameInstance({ seed: 198401, difficulty: 0, areaId: 83 })
    ;(game as unknown as { loadedAreas: Map<number, unknown> }).loadedAreas.set(83, {
      areaId: 83,
      rooms: [],
    })

    const playerId = game.connectPlayer({ charClass: 'sor', name: 'TravSorc', x: 20, y: 20, areaId: 83 })
    const internal = game as unknown as {
      players: Map<
        number,
        {
          areaId: number
          act: number
          x: number
          y: number
          questFlags: Uint16Array
          items: { code: string; location: string }[]
        }
      >
      groundItems: Map<number, { areaId: number; code: string }>
    }
    const player = internal.players.get(playerId)!
    player.act = 2
    player.areaId = 83
    player.x = 20
    player.y = 20

    // Real Travincal (Area 83) spawns Ismail Vilehand (councilmember1), Geleb Flamefinger (councilmember2),
    // and Toorc Icefist (councilmember1) — NO councilmember3!
    const ismail = game.spawnMonster({
      defId: 'councilmember1',
      x: 22,
      y: 20,
      areaId: 83,
      hp: 50,
      maxHp: 50,
      superUniqueId: 'Ismail Vilehand',
    })
    const geleb = game.spawnMonster({
      defId: 'councilmember2',
      x: 23,
      y: 20,
      areaId: 83,
      hp: 50,
      maxHp: 50,
      superUniqueId: 'Geleb Flamefinger',
    })
    const toorc = game.spawnMonster({
      defId: 'councilmember1',
      x: 24,
      y: 20,
      areaId: 83,
      hp: 50,
      maxHp: 50,
      superUniqueId: 'Toorc Icefist',
    })

    // 1st kill: drops Khalim's Flail ('qf1'), a3q5 NOT yet complete while Geleb & Toorc live
    game.applyDamageToMonster(ismail, 5000, playerId)
    const groundAfterFirst = [...internal.groundItems.values()].map((i) => i.code.trim().toLowerCase())
    expect(groundAfterFirst).toContain('qf1')
    expect(hasQuestFlag113c(player.questFlags, 'a3q5', QUEST_FLAG_COMPLETED_113C)).toBe(false)

    // 2nd kill: player has no Horadric Cube ('box'), so 1.13c 0x6FD07EA4 drops backup 'box'
    game.applyDamageToMonster(geleb, 5000, playerId)
    const groundAfterSecond = [...internal.groundItems.values()].map((i) => i.code.trim().toLowerCase())
    expect(groundAfterSecond).toContain('box')
    expect(hasQuestFlag113c(player.questFlags, 'a3q5', QUEST_FLAG_COMPLETED_113C)).toBe(false)

    // 3rd (last living) Council kill: completes a3q5 even without any councilmember3!
    game.applyDamageToMonster(toorc, 5000, playerId)
    expect(hasQuestFlag113c(player.questFlags, 'a3q5', QUEST_FLAG_COMPLETED_113C)).toBe(true)
    const groundAfterThird = [...internal.groundItems.values()].map((i) => i.code.trim().toLowerCase())
    expect(groundAfterThird.filter((c) => c === 'qf1')).toHaveLength(1)
  })

  it('never completes a3q5 or drops qf1/box from Council Members in Durance L3 (Area 102) or Throne of Destruction (Area 131)', () => {
    const game = new GameInstance({ seed: 198402, difficulty: 0, areaId: 102 })
    const playerId = game.connectPlayer({ charClass: 'sor', name: 'DuranceSorc', x: 15, y: 15, areaId: 102 })
    const internal = game as unknown as {
      players: Map<
        number,
        {
          areaId: number
          act: number
          x: number
          y: number
          questFlags: Uint16Array
        }
      >
      groundItems: Map<number, { areaId: number; code: string }>
    }
    const player = internal.players.get(playerId)!

    for (const nonTravAreaId of [102, 131]) {
      player.areaId = nonTravAreaId
      player.x = 15
      player.y = 15
      for (const defId of ['councilmember1', 'councilmember2', 'councilmember3']) {
        const id = game.spawnMonster({
          defId,
          x: 16,
          y: 15,
          areaId: nonTravAreaId,
          hp: 20,
          maxHp: 20,
        })
        game.applyDamageToMonster(id, 5000, playerId)
      }
      expect(hasQuestFlag113c(player.questFlags, 'a3q5', QUEST_FLAG_COMPLETED_113C)).toBe(false)
      const questDrops = [...internal.groundItems.values()].filter((g) => {
        const c = g.code.trim().toLowerCase()
        return c === 'qf1' || c === 'box'
      })
      expect(questDrops).toHaveLength(0)
    }
  })

  it('does not drop qf1 if a3q3 is already completed', () => {
    const game = new GameInstance({ seed: 198403, difficulty: 0, areaId: 83 })
    ;(game as unknown as { loadedAreas: Map<number, unknown> }).loadedAreas.set(83, {
      areaId: 83,
      rooms: [],
    })
    const playerId = game.connectPlayer({ charClass: 'sor', name: 'DoneA3Q3Sorc', x: 20, y: 20, areaId: 83 })
    const internal = game as unknown as {
      players: Map<
        number,
        {
          areaId: number
          act: number
          x: number
          y: number
          questFlags: Uint16Array
          items: { unitId: number; code: string; location: string; x: number; y: number }[]
        }
      >
      groundItems: Map<number, { areaId: number; code: string }>
    }
    const player = internal.players.get(playerId)!
    player.act = 2
    player.areaId = 83
    player.x = 20
    player.y = 20
    player.items.push({ unitId: 9001, code: 'box', location: 'inventory', x: 0, y: 0 })
    setQuestFlag113c(player.questFlags, 'a3q3', QUEST_FLAG_COMPLETED_113C)

    const m = game.spawnMonster({ defId: 'councilmember1', x: 21, y: 20, areaId: 83, hp: 20, maxHp: 20 })
    game.applyDamageToMonster(m, 5000, playerId)

    const flails = [...internal.groundItems.values()].filter(
      (g) => g.code.trim().toLowerCase() === 'qf1',
    )
    expect(flails).toHaveLength(0)
  })
})
