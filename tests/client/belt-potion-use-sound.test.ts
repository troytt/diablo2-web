import { describe, expect, it } from 'vitest'
import { AutomapView } from '../../src/client/automap/automap-view.ts'
import { CommandMapper, ViewportCamera } from '../../src/client/input/command-mapper.ts'
import { LocalMovementPredictor } from '../../src/client/motion/predictor.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { getSoundIdByName113c } from '../../src/common/audio/sounds-113c.ts'
import { getEmbeddedDropTables } from '../../src/common/items/embedded-drop-tables.ts'
import type { ClientCommand, ServerEvent } from '../../src/netproto/index.ts'

type ItemEventItem = Extract<ServerEvent, { type: 'ItemEvent' }>['item']

function makeBeltPotionItem(id: number, slot: number, code: string): ItemEventItem {
  return {
    id,
    itemId: id,
    opcode: 0x9c,
    action: 0x0e,
    category: 0,
    flags: 0,
    rawFlags: 0,
    version: 101,
    location: 2,
    container: 'belt',
    bodyLoc: 0,
    equippedSlot: 0,
    gridX: slot,
    gridY: 0,
    storePage: 0,
    storagePage: 0,
    worldX: 0,
    worldY: 0,
    x: slot,
    y: 0,
    code,
    rawCode: `${code} `,
    compact: true,
    simple: true,
    identified: true,
    socketed: false,
    ethereal: false,
    runeword: false,
    personalized: false,
    isEar: false,
    newItem: false,
    starterItem: false,
    broken: false,
    inSocket: false,
    equipped: false,
    socketedChildCount: 0,
    usedSockets: 0,
    totalSockets: 0,
    quality: 2,
    invWidth: 1,
    invHeight: 1,
    stats: [],
    setBonusStats: [],
    runewordStats: [],
  } as ItemEventItem
}

function expectedUseSound(code: string): number {
  const tables = getEmbeddedDropTables() as any
  const base = tables.getBase(code)
  const id = getSoundIdByName113c(base?.usesound ?? '') ?? 0
  expect(id).toBeGreaterThan(0)
  return id
}

function setup() {
  const world = new ClientWorld()
  world.apply({
    type: 'UnitAssign',
    unit: { unitType: 0, id: 1, classId: 1, name: 'Hero', x: 100, y: 100 },
    isSelf: true,
  })
  const hudManager = new HudManager()
  hudManager.resize(800, 600)
  const predictor = new LocalMovementPredictor({ initialX: 100, initialY: 100 })
  const automapView = new AutomapView()
  const camera = new ViewportCamera('800x600')
  camera.snapTo(100, 100)
  const dispatched: ClientCommand[] = []
  const sounds: number[] = []
  const hudModel = new HudModel({
    world,
    hudManager,
    predictor,
    automap: automapView,
    onCommand: (cmd) => dispatched.push(cmd),
    playUiSound: (id) => sounds.push(id),
  })
  const mapper = new CommandMapper({
    world,
    camera,
    hudManager,
    hudModel,
    predictor,
    automapView,
    sendCommand: (cmd) => dispatched.push(cmd),
  })
  return { world, hudManager, hudModel, mapper, dispatched, sounds }
}

describe('Belt potion drink plays Misc.txt usesound (D2Client.dll 0x6fb31d70)', () => {
  it('hotkey 1..4 sends BeltUse and plays the potion usesound exactly once', () => {
    const { world, hudModel, mapper, dispatched, sounds } = setup()
    world.apply({ type: 'ItemEvent', action: 0x0e, container: 'belt', item: makeBeltPotionItem(555, 0, 'hp4') })
    hudModel.sync()

    expect(mapper.handleKeyDown({ key: '1' }, 1000)).toBe(true)
    expect(dispatched.filter((c) => c.type === 'BeltUse')).toEqual([{ type: 'BeltUse', itemId: 555, shift: false }])
    expect(sounds).toEqual([expectedUseSound('hp4')])
  })

  it('hotkey on a column whose bottom row is empty still sounds for the potion actually drunk', () => {
    const { world, hudModel, mapper, dispatched, sounds } = setup()
    world.apply({ type: 'ItemEvent', action: 0x0e, container: 'belt', item: makeBeltPotionItem(777, 6, 'mp3') })
    hudModel.sync()

    expect(mapper.handleKeyDown({ key: '3' }, 1000)).toBe(true)
    expect(dispatched.filter((c) => c.type === 'BeltUse')).toEqual([{ type: 'BeltUse', itemId: 777, shift: false }])
    expect(sounds).toEqual([expectedUseSound('mp3')])
  })

  it('hotkey on an empty column emits nothing and plays no sound', () => {
    const { hudModel, mapper, dispatched, sounds } = setup()
    hudModel.sync()
    expect(mapper.handleKeyDown({ key: '2' }, 1000)).toBe(true)
    expect(dispatched.some((c) => c.type === 'BeltUse')).toBe(false)
    expect(sounds).toEqual([])
  })

  it('right-clicking a belt slot plays the usesound', () => {
    const { world, hudManager, hudModel, dispatched, sounds } = setup()
    world.apply({ type: 'ItemEvent', action: 0x0e, container: 'belt', item: makeBeltPotionItem(901, 1, 'rvs') })
    hudModel.sync()

    expect(hudManager.drinkBeltSlot(1)).toBe(true)
    expect(dispatched.filter((c) => c.type === 'BeltUse')).toEqual([{ type: 'BeltUse', itemId: 901, shift: false }])
    expect(sounds).toEqual([expectedUseSound('rvs')])
  })
})
