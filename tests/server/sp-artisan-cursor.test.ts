import { describe, expect, it } from 'vitest'
import { LocalLobbyProvider, type LocalLoopbackAdapter } from '../../src/server/index.ts'
import type { ServerEvent } from '../../src/netproto/index.ts'
import { testCharacterSaves } from '../../tools/test-characters.ts'

const CHARSI = 154

async function atCharsi(name: string) {
  const lobby = new LocalLobbyProvider({ seed: 937 })
  await lobby.importCharacterD2s(testCharacterSaves().get(name)!)
  const adapter: LocalLoopbackAdapter = await lobby.enterGame({ charName: name, difficulty: 0 })
  const events: ServerEvent[] = []
  adapter.onEvent((event) => events.push(event))
  const self = adapter.game.getPlayerState(adapter.playerUnitId)!
  const charsi = adapter.game.spawnMonster({ classId: CHARSI, x: self.x + 1, y: self.y, areaId: self.areaId, isNpc: true })
  adapter.send({ type: 'NpcInit', target: { unitType: 'monster', id: charsi } })
  adapter.stepFrames(1)
  const items = () => adapter.game.getPlayerState(adapter.playerUnitId)!.items
  const imbue = (code: string) => {
    const itemId = items().find((item) => item.code === code)!.unitId
    adapter.send({ type: 'ItemToCursor', itemId })
    adapter.stepFrames(1)
    const onCursor = items().find((item) => item.unitId === itemId)?.location
    adapter.send({ type: 'NpcEntityAction', action: 0, npcId: charsi, complement: itemId })
    adapter.stepFrames(1)
    return { itemId, onCursor, after: items().find((item) => item.unitId === itemId), answer: events.filter((event) => event.type === 'OpenUi').at(-1) }
  }
  return { adapter, imbue, items, charsi }
}

describe('Single Player artisans take the item from the cursor', () => {
  it('Charsi imbues the crown held on the cursor and hands it back into the inventory', async () => {
    const { imbue, items, charsi } = await atCharsi('TestFireSorc')
    const { onCursor, after, answer } = imbue('xrn')
    expect(onCursor).toBe('cursor')
    expect(String(after?.quality)).toBe('rare')
    expect(after?.location).toBe('inventory')
    expect(items().some((item) => item.location === 'cursor')).toBe(false)
    expect(answer).toMatchObject({ uiId: 6, unitId: charsi })
  })

  it('refuses an item he cannot imbue and lets it fall at the player\'s feet like the live server', async () => {
    const { adapter, imbue, charsi } = await atCharsi('TestFireSorc')
    const { itemId, after, answer } = imbue('gcr')
    expect(after).toBeUndefined()
    expect(adapter.game.getGroundItems().some((item) => item.unitId === itemId)).toBe(true)
    expect(answer).toMatchObject({ uiId: 7, unitId: charsi })
  })
})
