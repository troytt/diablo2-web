/**
 * Issue #1358 follow-up — hire list and MercReviveCost events.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

function setup(seed: number) {
  const game = new GameInstance({ seed, areaId: 1 })
  const playerId = game.connectPlayer({ charClass: 'pal', name: 'Actor', x: 10, y: 10, areaId: 1 })
  const player = (game as unknown as {
    players: Map<number, { gold: number; activeNpcId: number | undefined }>
  }).players.get(playerId)!
  player.gold = 100_000
  const npcId = game.spawnMonster({
    classId: 150, name: 'Kashya', x: 11, y: 10, areaId: 1, isNpc: true,
  })
  player.activeNpcId = npcId
  return { game, playerId, player, npcId }
}

describe('issue #1358 hire list and revive cost', () => {
  it('emits the hire list for a mercenary vendor', () => {
    const { game, playerId, npcId } = setup(1358)
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'NpcEntityAction', npcId, action: 3, complement: 0 } as never)
    game.stepFrames(1)
    const hires = game.drainEvents(playerId).filter(
      (e) => e.type === 'Merc' && (e as { kind?: string }).kind === 'hireList',
    )
    expect(hires.length).toBeGreaterThan(1)
    expect(hires.some((e) => typeof (e as { nameId?: number }).nameId === 'number')).toBe(true)
  })

  it('emits the revive cost before resurrecting the mercenary', () => {
    const { game, playerId, player, npcId } = setup(1359)
    const mercId = game.hireMercenary(playerId, { act: 1, level: 10, hp: 100, maxHp: 100 })
    const merc = (game as unknown as {
      mercenaries: Map<number, { alive: boolean; hp: number }>
    }).mercenaries.get(mercId)!
    merc.alive = false
    merc.hp = 0
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'MercResurrect', npcId } as never)
    game.stepFrames(1)
    const cost = game.drainEvents(playerId).find(
      (e) => e.type === 'Merc' && (e as { kind?: string }).kind === 'stat',
    ) as { value?: number } | undefined
    expect(cost?.value).toBe(1000)
    expect(merc.alive).toBe(true)
    expect(player.gold).toBe(99_000)
  })
})
