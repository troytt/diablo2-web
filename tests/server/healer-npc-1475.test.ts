import { describe, expect, it } from 'vitest'
import { CURABLE_STATE_IDS_113C } from '../../src/common/world/object-operate-113c.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

interface TestPlayerView {
  hp: number
  maxHp: number
  hpFixed: number
  maxHpFixed: number
  mana: number
  maxMana: number
  manaFixed: number
  maxManaFixed: number
  stamina: number
  maxStamina: number
  staminaFixed: number
  maxStaminaFixed: number
  activeNpcId: number | undefined
  states: Set<number>
  stateTimers: Map<number, number>
}

function getPlayer(game: GameInstance, id: number): TestPlayerView {
  return (game as unknown as { players: Map<number, TestPlayerView> }).players.get(id)!
}

function createTestGame() {
  const game = new GameInstance({
    difficulty: 0,
  })
  const playerId = game.connectPlayer({
    charClass: 'pal',
    name: 'Hero',
    x: 5000,
    y: 5000,
    areaId: 1,
  })
  const player = getPlayer(game, playerId)

  // Give player known vitals
  player.maxHp = 200
  player.maxHpFixed = 200 * 256
  player.hp = 50
  player.hpFixed = 50 * 256

  player.maxMana = 150
  player.maxManaFixed = 150 * 256
  player.mana = 30
  player.manaFixed = 30 * 256

  player.maxStamina = 120
  player.maxStaminaFixed = 120 * 256
  player.stamina = 40
  player.staminaFixed = 40 * 256

  return { game, player, playerId }
}

describe('Issue #1475: 1.13c Town Healer NPCs (0x6FCDD490 / 0x6FCDCBE0 / 0x6FCDC920)', () => {
  it('CURABLE_STATE_IDS_113C matches 1.13c States.txt curable==1 plus state 1 and 2', () => {
    // 13 rows from States.txt where curable === 1: 9, 19, 23, 27, 55, 56, 57, 58, 59, 60, 61, 113, 114
    // Plus state 1 (freeze) and state 2 (poison)
    expect(CURABLE_STATE_IDS_113C).toEqual([
      1, 2, 9, 19, 23, 27, 55, 56, 57, 58, 59, 60, 61, 113, 114,
    ])
  })

  it('healer (Akara) restores HP, Mana, and Stamina to max and clears all 15 curable states while leaving non-curables untouched', () => {
    const { game, player, playerId } = createTestGame()

    const akara = game.spawnMonster({
      classId: 148,
      name: 'Akara',
      x: 5002,
      y: 5000,
      areaId: 1,
      isNpc: true,
    })

    // Apply all 15 curable states
    for (const sid of CURABLE_STATE_IDS_113C) {
      player.states.add(sid)
      player.stateTimers.set(sid, 1000)
    }

    // Apply non-curable states (11 cold slow, 17 innersight, 28 conviction, 89 battlecry, 128 armor shrine, 156 cloaked)
    const nonCurables = [11, 17, 28, 89, 128, 156]
    for (const sid of nonCurables) {
      player.states.add(sid)
      player.stateTimers.set(sid, 1000)
    }

    player.activeNpcId = akara
    game.enqueueCommand(playerId, { type: 'NpcHeal', npcId: akara } as never)
    game.stepFrames(1)

    // 1.13c D2Game.dll 0x6fcdd490: HP (stat 6), Mana (stat 8), and Stamina (stat 10) restored to max
    expect(player.hp).toBe(player.maxHp)
    expect(player.hpFixed).toBe(player.maxHpFixed)
    expect(player.mana).toBe(player.maxMana)
    expect(player.manaFixed).toBe(player.maxManaFixed)
    expect(player.stamina).toBe(player.maxStamina)
    expect(player.staminaFixed).toBe(player.maxStaminaFixed)

    // All curable states must be cleared
    for (const sid of CURABLE_STATE_IDS_113C) {
      expect(player.states.has(sid), `curable state ${sid} should be cleared`).toBe(false)
    }

    // Non-curable states must persist
    for (const sid of nonCurables) {
      expect(player.states.has(sid), `non-curable state ${sid} should persist`).toBe(true)
    }
  })

  it('healer also heals HP on the active mercenary and cures states on pets per sub_6FCB6AF0', () => {
    const { game, player, playerId } = createTestGame()

    const akara = game.spawnMonster({
      classId: 148,
      name: 'Akara',
      x: 5002,
      y: 5000,
      areaId: 1,
      isNpc: true,
    })

    const mercs = (game as unknown as {
      mercenaries: Map<number, {
        unitId: number
        ownerPlayerId: number
        areaId: number
        hp: number
        maxHp: number
        alive: boolean
      }>
    }).mercenaries

    mercs.set(7001, {
      unitId: 7001,
      ownerPlayerId: playerId,
      areaId: 1,
      hp: 25,
      maxHp: 100,
      alive: true,
    })

    player.activeNpcId = akara
    game.enqueueCommand(playerId, { type: 'NpcHeal', npcId: akara } as never)
    game.stepFrames(1)

    const merc = mercs.get(7001)!
    expect(merc.hp).toBe(100)
  })

  it('non-healer NPC (Charsi) does not restore HP or cure states', () => {
    const { game, player, playerId } = createTestGame()

    const charsi = game.spawnMonster({
      classId: 154,
      name: 'Charsi',
      x: 5002,
      y: 5000,
      areaId: 1,
      isNpc: true,
    })

    player.states.add(2) // poison
    player.activeNpcId = charsi
    game.enqueueCommand(playerId, { type: 'NpcHeal', npcId: charsi } as never)
    game.stepFrames(1)

    expect(player.hp).toBe(50)
    expect(player.states.has(2)).toBe(true)
  })
})
