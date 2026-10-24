import { describe, expect, it } from 'vitest'
import { CommandMapper, ViewportCamera } from '../../src/client/input/command-mapper.ts'
import { LocalMovementPredictor } from '../../src/client/motion/predictor.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import type { ClientCommand } from '../../src/netproto/index.ts'

const MONSTER_ID = 901
const ITEM_ID = 701

function createSetup(dragInteractMode: boolean, areaId = 2) {
  const world = new ClientWorld()
  world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId })
  world.apply({ type: 'UnitAssign', unit: { unitType: 0, id: 1, classId: 1, name: 'Hero', x: 100, y: 100 }, isSelf: true })
  world.getUnit('player', 1)!.mode = 3
  const hudManager = new HudManager()
  hudManager.resize(800, 600)
  const predictor = new LocalMovementPredictor({ initialX: 100, initialY: 100 })
  const camera = new ViewportCamera('800x600')
  camera.snapTo(100, 100)
  const sent: ClientCommand[] = []
  const hudModel = new HudModel({ world, hudManager, predictor, onCommand: (cmd) => sent.push(cmd) })
  const mapper = new CommandMapper({ world, camera, hudManager, hudModel, predictor, sendCommand: (cmd) => sent.push(cmd) })
  mapper.dragInteractMode = dragInteractMode
  const pressOnGroundThenDragTo = (subX: number, subY: number, nowMs: number) => {
    const ground = camera.subtileToScreen(100, 94)
    mapper.handlePointerDown(ground.x, ground.y, 0, nowMs)
    sent.length = 0
    const target = camera.subtileToScreen(subX, subY)
    mapper.handlePointerMove(target.x, target.y, nowMs + 50)
    mapper.tick(nowMs + 100)
  }
  const spawnMonster = (classId: number, x: number, y: number) =>
    world.apply({ type: 'UnitAssign', unit: { unitType: 1, id: MONSTER_ID, classId, name: 'Monster', x, y, lifePct: 128, mode: 1 } })
  const spawnItem = (x: number, y: number) =>
    world.apply({ type: 'UnitAssign', unit: { unitType: 4, id: ITEM_ID, classId: 10, name: 'Gold', x, y } })
  const targets = (id: number) => sent.filter((c) => [`"id":${id}`, `"itemId":${id}`].some((needle) => JSON.stringify(c).includes(needle)))
  const pressOn = (subX: number, subY: number, nowMs: number) => {
    const at = camera.subtileToScreen(subX, subY)
    mapper.handlePointerDown(at.x, at.y, 0, nowMs)
  }
  const dragTo = (subX: number, subY: number, nowMs: number) => {
    const at = camera.subtileToScreen(subX, subY)
    mapper.handlePointerMove(at.x, at.y, nowMs)
  }
  return { mapper, sent, pressOn, dragTo, pressOnGroundThenDragTo, spawnMonster, spawnItem, targets }
}

describe('drag-interact mode', () => {
  it('vanilla hold does not attack a monster the cursor passes over while running', () => {
    const s = createSetup(false)
    s.spawnMonster(19, 103, 100)
    s.pressOnGroundThenDragTo(103, 100, 1000)
    expect(s.targets(MONSTER_ID)).toEqual([])
  })

  it('attacks a hostile monster dragged over while running', () => {
    const s = createSetup(true)
    s.spawnMonster(19, 103, 100)
    s.pressOnGroundThenDragTo(103, 100, 1000)
    expect(s.targets(MONSTER_ID).length).toBeGreaterThan(0)
  })

  it('picks up a nearby item dragged over, once per press', () => {
    const s = createSetup(true)
    s.spawnItem(102, 100)
    s.pressOnGroundThenDragTo(102, 100, 1000)
    s.mapper.tick(1200)
    s.mapper.tick(1300)
    expect(s.sent.filter((c) => c.type === 'ItemPickup')).toEqual([{ type: 'ItemPickup', itemId: ITEM_ID, toCursor: false }])
  })

  it('walks toward a far item instead of picking it up from range', () => {
    const s = createSetup(true)
    s.spawnItem(110, 100)
    s.pressOnGroundThenDragTo(110, 100, 1000)
    expect(s.sent.filter((c) => c.type === 'ItemPickup')).toEqual([])
  })

  it('never opens a town NPC by dragging over it', () => {
    const s = createSetup(true, 1)
    s.spawnMonster(148, 97, 100)
    s.pressOnGroundThenDragTo(97, 100, 1000)
    expect(s.targets(MONSTER_ID)).toEqual([])
  })

  it.each([true, false])('keeps talking to a town NPC clicked from nearby while the button is held (drag mode %s)', (drag) => {
    const s = createSetup(drag, 1)
    s.spawnMonster(148, 101, 100)
    s.pressOn(101, 100, 1000)
    s.mapper.tick(1040)
    s.dragTo(100, 94, 1080)
    s.mapper.tick(1120)
    s.mapper.tick(1160)
    expect(s.sent.map((c) => c.type)).toContain('NpcInit')
    expect(s.sent.filter((c) => c.type === 'Move')).toEqual([])
  })

  it.each([true, false])('still walks to a far town NPC clicked once and held (drag mode %s)', (drag) => {
    const s = createSetup(drag, 1)
    s.spawnMonster(148, 110, 100)
    s.pressOn(110, 100, 1000)
    s.mapper.tick(1040)
    s.dragTo(100, 94, 1080)
    s.mapper.tick(1120)
    expect(s.sent.filter((c) => c.type === 'Move')).toEqual([])
    expect(s.sent.map((c) => c.type)).toContain('MoveToUnit')
  })
})
