import { describe, expect, it } from 'vitest'
import { LocalLobbyProvider, type LocalLoopbackAdapter } from '../../src/server/index.ts'
import type { ServerEvent } from '../../src/netproto/index.ts'
import { testCharacterSaves } from '../../tools/test-characters.ts'

describe('Single Player NPC range', () => {
  it('talks to an NPC from the in-between position a walk leaves the player at', async () => {
    const lobby = new LocalLobbyProvider({ seed: 7 })
    await lobby.importCharacterD2s(testCharacterSaves().get('TestFireSorc')!)
    const adapter: LocalLoopbackAdapter = await lobby.enterGame({ charName: 'TestFireSorc', difficulty: 0 })
    const events: ServerEvent[] = []
    adapter.onEvent((event) => events.push(event))
    const player = (adapter.game as unknown as { players: Map<number, { x: number; y: number; areaId: number }> }).players.get(adapter.playerUnitId)!
    const charsi = adapter.game.spawnMonster({ classId: 154, x: player.x + 2, y: player.y, areaId: player.areaId, isNpc: true })
    Object.assign(player, { x: player.x + 0.52, y: player.y + 0.52 })
    adapter.send({ type: 'Interact', target: { unitType: 'monster', id: charsi } })
    adapter.send({ type: 'NpcInit', target: { unitType: 'monster', id: charsi } })
    adapter.stepFrames(2)
    expect(events.filter((event) => event.type === 'Chat' && event.text.startsWith('Command failed'))).toEqual([])
  })
})
