import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import type { ClientCommand } from '../../src/netproto/index.ts'

const CHARSI = 154
const NPC = 4210
const BOOTS = 77

function atCharsi() {
  const world = new ClientWorld()
  const hud = new HudManager()
  const commands: ClientCommand[] = []
  const model = new HudModel({ world, hudManager: hud, onCommand: (cmd) => {
    commands.push(cmd)
    world.noteOutgoingCommand(cmd)
  } })
  hud.commandSink = model
  world.apply({ type: 'UnitAssign', isSelf: true, unit: { unitType: 'player', id: 1, classId: 4, name: 'Tester', x: 5100, y: 5050, lifePct: 128, mode: 1 } } as never)
  world.apply({ type: 'UnitAssign', unit: { unitType: 'monster', id: NPC, classId: CHARSI, x: 5102, y: 5050, lifePct: 128, mode: 1 } } as never)
  world.quests[3] = 0x0002
  world.containers.applyItemEvent(0x00, { id: BOOTS, itemId: BOOTS, code: 'vbt', rawCode: 'vbt ', quality: 2, identified: true, invWidth: 2, invHeight: 2, gridX: 2, gridY: 2, x: 2, y: 2, container: 'inventory', location: 0, stats: [] } as never, 'inventory', 1)
  world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: 1, id: NPC } })
  model.handleNpcMenuAction('imbue', NPC)
  commands.length = 0
  return { world, hud, model, commands }
}

describe('artisans on the live server', () => {
  it('restarts the talk with Charsi once the item is on the cursor, so the server accepts the imbue', () => {
    const { world, hud, model, commands } = atCharsi()
    model.pickupItemToCursor(BOOTS)
    const target = { unitType: 1, id: NPC }
    expect(commands).toEqual([{ type: 'ItemToCursor', itemId: BOOTS }, { type: 'NpcCancel', target }, { type: 'Interact', target }, { type: 'NpcInit', target }])
    expect([hud.leftPanel, world.npcInteraction.activeWindow, world.npcInteraction.npcId, hud.worldPanels.npcMenu]).toEqual(['imbue', 'imbue', NPC, null])
  })

  it('keeps the confirm itself to the single request the server expects', () => {
    const { model, commands } = atCharsi()
    model.pickupItemToCursor(BOOTS)
    commands.length = 0
    model.confirmQuestReward(BOOTS, NPC)
    expect(commands).toEqual([{ type: 'NpcEntityAction', action: 0, npcId: NPC, complement: BOOTS }])
  })

  it('leaves ordinary pickups alone', () => {
    const { world, model, commands } = atCharsi()
    model.closeActiveNpcPanel()
    commands.length = 0
    world.noteOutgoingCommand({ type: 'NpcCancel', target: { unitType: 1, id: NPC } })
    model.pickupItemToCursor(BOOTS)
    expect(commands).toEqual([{ type: 'ItemToCursor', itemId: BOOTS }])
  })
})
