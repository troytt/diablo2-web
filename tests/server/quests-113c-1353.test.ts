/**
 * Issue #1353 — server quest flags: QuestState 0x29 on join, Den of Evil clear,
 * quest-object progress, quest-gated areas and .d2s persistence.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { readD2sSave113c } from '../../src/server/save/d2s-reader.ts'
import {
  QUEST_FLAG_COMPLETED_113C,
  QUEST_FLAG_STARTED_113C,
} from '../../src/server/engine/quests-113c.ts'

function connect(game: GameInstance, areaId = 1): number {
  return game.connectPlayer({ charClass: 'sor', name: 'Quester', x: 50, y: 50, areaId })
}

function playerRecord(game: GameInstance, id: number): {
  areaId: number
  newSkills: number
  questFlags: Uint16Array
} {
  return (game as unknown as {
    players: Map<number, { areaId: number; newSkills: number; questFlags: Uint16Array }>
  }).players.get(id)!
}

describe('issue #1353 quest state machine', () => {
  it('sends the 0x29 quest log with 48 words on join', () => {
    const game = new GameInstance({ seed: 1353, areaId: 1 })
    const playerId = connect(game)
    const events = game.drainEvents(playerId)
    const log = events.find((e) => e.type === 'QuestState') as
      | { kind?: string; source?: number; quests: Uint16Array }
      | undefined
    expect(log).toBeDefined()
    expect(log!.kind).toBe('log')
    expect(log!.source).toBe(0x29)
    expect(log!.quests).toHaveLength(48)
  })

  it('completes Den of Evil after the last monster in level 8 dies and grants a skill point', () => {
    const game = new GameInstance({ seed: 1354, areaId: 8 })
    const playerId = connect(game, 8)
    const a = game.spawnMonster({ defId: 'fallen1', x: 52, y: 50, areaId: 8 })
    const b = game.spawnMonster({ defId: 'fallen1', x: 54, y: 50, areaId: 8 })
    game.drainEvents(playerId)
    const skillsBefore = playerRecord(game, playerId).newSkills

    game.applyDamageToMonster(a, 1000, playerId)
    expect(playerRecord(game, playerId).questFlags[1]! & QUEST_FLAG_COMPLETED_113C).toBe(0)
    game.applyDamageToMonster(b, 1000, playerId)
    expect(playerRecord(game, playerId).questFlags[1]! & QUEST_FLAG_COMPLETED_113C).toBe(
      QUEST_FLAG_COMPLETED_113C,
    )
    expect(playerRecord(game, playerId).newSkills).toBe(skillsBefore + 1)
    expect(
      game.drainEvents(playerId).some(
        (e) => e.type === 'QuestState' && (e as { quests: Uint16Array }).quests[1]! & 1,
      ),
    ).toBe(true)
  })

  it('advances the Inifuss quest object and persists the flag in .d2s', () => {
    const game = new GameInstance({ seed: 1355, areaId: 1 })
    const playerId = connect(game)
    const inifuss = game.spawnObject({ classId: 30, x: 50, y: 50, areaId: 1 })
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: inifuss })
    game.stepFrames(1)
    // a1q3 titleKey qstsa1q4 -> word 4, bit 1 = started.
    expect(playerRecord(game, playerId).questFlags[4]! & QUEST_FLAG_STARTED_113C).toBe(
      QUEST_FLAG_STARTED_113C,
    )

    const d2s = game.exportPlayerD2s(playerId)
    expect(d2s).not.toBeNull()
    const parsed = readD2sSave113c(d2s!)
    expect(parsed.quests[game.difficulty][4]! & QUEST_FLAG_STARTED_113C).toBe(
      QUEST_FLAG_STARTED_113C,
    )
  })

  it('blocks quest-gated areas until the quest is accepted', () => {
    const game = new GameInstance({ seed: 1356, areaId: 1 })
    const playerId = connect(game)
    const record = playerRecord(game, playerId)
    const transition = (game as unknown as {
      transitionPlayerArea: (p: unknown, area: number, arrival: { kind: string }) => boolean
    }).transitionPlayerArea.bind(game)

    expect(transition(record, 38, { kind: 'townPortal' })).toBe(false)
    expect(record.areaId).toBe(1)
    expect(
      game.drainEvents(playerId).some(
        (e) => e.type === 'Chat' && e.text.includes('area 38'),
      ),
    ).toBe(true)

    // a1q3 is word 4; accept it then Tristram opens.
    record.questFlags[4] = (record.questFlags[4] ?? 0) | QUEST_FLAG_STARTED_113C
    expect(transition(record, 38, { kind: 'townPortal' })).toBe(true)
    expect(record.areaId).toBe(38)
  })
})