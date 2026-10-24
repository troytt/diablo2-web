/**
 * Issue #866 — 1.13c Parity:
 * - S2C 0x77 action 0x11 (`BUTTON_ACTION_CLOSE_STASH`, D2Client.dll 0x6fb09ed0 / D2Game.dll 0x6fccd9c0)
 * - World-click movement auto-cancelling active NPC (`C2S 0x30 NpcCancel`) & Stash (`C2S 0x4F 0x12 CloseStash`)
 * - 25 Hz per-tick guard: NPC unit alive / existence only (`D2Client.dll 0x6faf83b0`, no distance check, #890);
 *   Stash interaction range / player alive
 * - S2C 0x0A `UnitRemove` of active NPC or Stash object (`classId = 267` / `0x10B`)
 */
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { replayD2CapFile } from '../../tools/netproto-replay.ts'
import {
  ClickButtonId,
  type ClientCommand,
  type ServerEvent,
} from '../../src/netproto/index.ts'
import { decode0x77ButtonActions } from '../../src/netproto/d2gs/s2c/trade.ts'
import { encodeD2gsClientCommand } from '../../src/netproto/d2gs/registry.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { D2StatId } from '../../src/client/world/stat-list.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import { LocalMovementPredictor } from '../../src/client/motion/predictor.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import type { VendorPriceFn, VendorRepairAllFn } from '../../src/client/ui-model/vendor-price.ts'

if (typeof globalThis.window === 'undefined') {
  ;(globalThis as unknown as { window: Record<string, unknown> }).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
  }
}

const FIXTURES = path.resolve(__dirname, '../fixtures/netproto')
const CHARSI_ID = 6
const STASH_OBJECT_ID = 50
const STASH_CLASS_ID = 267 // 0x10B

const stubPrice: VendorPriceFn = (item, type) => 1000 * (type + 1) + item.id
const stubRepairAll: VendorRepairAllFn = () => 777

function loadCapture(name: string): readonly ServerEvent[] {
  const r = replayD2CapFile(path.join(FIXTURES, name), { strict: true })
  expect(r.unknownPackets).toBe(0)
  return r.events
}

function createInteractiveHarness(opts?: { width?: number; height?: number; selfX?: number; selfY?: number }) {
  const width = opts?.width ?? 1280
  const height = opts?.height ?? 720
  const selfX = opts?.selfX ?? 5000
  const selfY = opts?.selfY ?? 5000

  const world = new ClientWorld()
  const hud = new HudManager()
  hud.resize(width, height)

  const commands: ClientCommand[] = []
  let nowMs = 50_000

  const model = new HudModel({
    world,
    hudManager: hud,
    onCommand: (cmd) => {
      commands.push(cmd)
      world.noteOutgoingCommand(cmd, nowMs)
    },
    vendorPrice: stubPrice,
    vendorRepairAll: stubRepairAll,
    now: () => nowMs,
  })
  hud.commandSink = model

  const predictor = new LocalMovementPredictor({
    initialX: selfX,
    initialY: selfY,
  })

  const subWidth = 128
  const subHeight = 128
  const walkable = new Uint8Array(subWidth * subHeight)
  walkable.fill(1)
  const levelView = {
    levelId: 1,
    subOriginX: selfX - 64,
    subOriginY: selfY - 64,
    subWidth,
    subHeight,
    walkable,
  }
  const mockCamera = {
    subtileToScreen(x: number, y: number) {
      return { x: (x - selfX) * 16 + width / 2, y: (y - selfY) * 8 + (height - 48) / 2 }
    },
    screenToSubtile(x: number, y: number) {
      return {
        x: Math.round((x - width / 2) / 16 + selfX),
        y: Math.round((y - (height - 48) / 2) / 8 + selfY),
      }
    },
    update() {},
  }

  const mapper = new CommandMapper({
    world,
    hudManager: hud,
    hudModel: model,
    predictor,
    automapView: { getLevelView: () => levelView } as any,
    camera: mockCamera as any,
    sendCommand: (cmd) => {
      commands.push(cmd)
      world.noteOutgoingCommand(cmd, nowMs)
    },
  })

  world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x12345678, areaId: 1 })
  world.apply({
    type: 'UnitAssign',
    isSelf: true,
    unit: {
      unitType: 0,
      id: 1,
      classId: 1,
      name: 'Hero',
      x: selfX,
      y: selfY,
    },
  })
  model.syncFromWorld()
  commands.length = 0

  return {
    world,
    hud,
    model,
    mapper,
    predictor,
    commands,
    advanceClock(ms: number) {
      nowMs += ms
      return nowMs
    },
  }
}

describe('Issue #866 — S2C 0x77 0x11 Close Stash (D2Client 0x6fb09ed0 / D2Game 0x6fccd9c0)', () => {
  it('decodes S2C 0x77 action 0x11 and closes stash + coupled inventory + deposit/withdraw gold dialog without echoing C2S 0x4F 0x12', () => {
    const raw = Uint8Array.of(0x77, 0x11)
    const decoded = decode0x77ButtonActions(raw)
    expect(decoded).toEqual({
      type: 'Trade',
      action: 0x11,
    })

    for (const goldMode of [3, 4] as const) {
      const h = createInteractiveHarness({ width: 1280, height: 720 })
      for (const ev of loadCapture('08-d2gs-stash-gold.d2cap')) {
        h.world.apply(ev)
      }
      h.world.apply({ type: 'StatSet', stat: D2StatId.Gold, value: 2500 })
      h.world.apply({ type: 'StatSet', stat: D2StatId.GoldBank, value: 1800 })
      h.model.syncFromWorld()

      expect(h.world.npcInteraction.stashOpen).toBe(true)
      expect(h.hud.leftPanel).toBe('stash')
      expect(h.hud.rightPanel).toBe('inv')
      expect(h.hud.inventory.visible).toBe(true)

      h.hud.openGoldDialog(goldMode)
      expect(h.hud.goldDialog?.mode).toBe(goldMode)
      h.commands.length = 0

      // Server sends S2C 0x77 0x11 (e.g. D2Game 0x6fccd9c0 auto-close on distance > 9)
      h.world.apply(decoded)
      expect(h.world.npcInteraction.stashOpen).toBe(false)

      h.model.syncFromWorld()
      expect(h.hud.leftPanel).toBe('none')
      expect(h.hud.rightPanel).toBe('none')
      expect(h.hud.inventory.visible).toBe(false)
      expect(h.hud.goldDialog).toBeNull()
      // Server-initiated close must NOT echo a redundant C2S 0x4F 0x12
      expect(h.commands).toEqual([])
    }
  })
})

describe('Issue #866 — World-click movement auto-cancels open Stash & NPC UI', () => {
  it('clicking the exposed world gap (x=640, y=300) at 1280x720 while Stash is open emits C2S 0x4F 0x12 CloseStash once and closes Stash + Inventory', () => {
    const h = createInteractiveHarness({ width: 1280, height: 720, selfX: 5000, selfY: 5000 })
    h.world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 2,
        id: STASH_OBJECT_ID,
        classId: STASH_CLASS_ID,
        mode: 0,
        x: 5000,
        y: 5001,
      },
    })
    h.world.apply({ type: 'Trade', action: 0x10 })
    h.model.syncFromWorld()
    expect(h.hud.leftPanel).toBe('stash')
    expect(h.hud.rightPanel).toBe('inv')
    expect(h.hud.isPointInterceptedByHud(640, 300)).toBe(false)
    h.commands.length = 0

    // Left-click world ground in the widescreen center gap (400..880)
    const now = h.advanceClock(200)
    h.mapper.handlePointerDown(640, 300, 0, now)
    h.mapper.handlePointerUp(0)

    const closeCmds = h.commands.filter(
      (c) => c.type === 'ClickButton' && c.buttonId === ClickButtonId.CloseStash,
    )
    expect(closeCmds).toHaveLength(1)
    expect([...encodeD2gsClientCommand(closeCmds[0]!)[0]!]).toEqual([
      0x4f, 0x12, 0x00, 0x00, 0x00, 0x00, 0x00,
    ])
    expect(h.commands.some((c) => c.type === 'Move')).toBe(true)
    expect(h.world.npcInteraction.stashOpen).toBe(false)
    expect(h.hud.leftPanel).toBe('none')
    expect(h.hud.rightPanel).toBe('none')
  })

  it('clicking the exposed world gap at 1280x720 while NPC vendor shop is open emits C2S 0x30 NpcCancel once, clears shop, and closes Vendor + Inventory', () => {
    const h = createInteractiveHarness({ width: 1280, height: 720, selfX: 5000, selfY: 5000 })
    const events = loadCapture('05-d2gs-vendor-open.d2cap')
    for (const ev of events) {
      h.world.apply(ev)
    }
    const charsi = h.world.getUnit('monster', CHARSI_ID)!
    charsi.x = 5000
    charsi.y = 5001
    h.world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: 1, id: CHARSI_ID } })
    h.model.syncFromWorld()
    while (h.hud.worldPanels.npcSpeech !== null) {
      h.hud.worldPanels.closeNpcSpeech()
      h.model.syncFromWorld()
    }
    h.model.openNpcTrade(CHARSI_ID)
    for (const ev of events.filter((e) => e.type === 'ItemEvent' && e.container === 'shop')) {
      h.world.apply(ev)
    }
    h.model.syncFromWorld()

    expect(h.hud.leftPanel).toBe('vendor')
    expect(h.hud.rightPanel).toBe('inv')
    expect(h.world.containers.shop.size).toBeGreaterThan(0)
    h.commands.length = 0

    // Left-click world ground in the widescreen center gap (x=640, y=300)
    const now = h.advanceClock(200)
    h.mapper.handlePointerDown(640, 300, 0, now)
    h.mapper.handlePointerUp(0)

    const cancelCmds = h.commands.filter((c) => c.type === 'NpcCancel')
    expect(cancelCmds).toEqual([
      { type: 'NpcCancel', target: { unitType: 1, id: CHARSI_ID } },
    ])
    expect([...encodeD2gsClientCommand(cancelCmds[0]!)[0]!]).toEqual([
      0x30, 0x01, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00,
    ])
    expect(h.commands.some((c) => c.type === 'Move')).toBe(true)
    expect(h.world.npcInteraction.npcId).toBeNull()
    expect(h.world.containers.shop.size).toBe(0)
    expect(h.hud.leftPanel).toBe('none')
    expect(h.hud.rightPanel).toBe('none')
  })

  it('clicking world ground at 800x600 while NPC stone menu is open cancels the NPC session and moves', () => {
    const h = createInteractiveHarness({ width: 800, height: 600, selfX: 5000, selfY: 5000 })
    const events = loadCapture('05-d2gs-vendor-open.d2cap')
    for (const ev of events.filter((e) => !(e.type === 'ItemEvent' && e.container === 'shop'))) {
      h.world.apply(ev)
    }
    const charsi = h.world.getUnit('monster', CHARSI_ID)!
    charsi.x = 5000
    charsi.y = 5001
    h.world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: 1, id: CHARSI_ID } })
    h.model.syncFromWorld()
    while (h.hud.worldPanels.npcSpeech !== null) {
      h.hud.worldPanels.closeNpcSpeech()
      h.model.syncFromWorld()
    }
    expect(h.hud.worldPanels.npcMenu?.npcId).toBe(CHARSI_ID)
    h.commands.length = 0

    // Click world ground outside the stone menu at (100, 200)
    expect(h.hud.isPointInterceptedByHud(100, 200)).toBe(false)
    const now = h.advanceClock(200)
    h.mapper.handlePointerDown(100, 200, 0, now)
    h.mapper.handlePointerUp(0)

    expect(h.commands.filter((c) => c.type === 'NpcCancel')).toEqual([
      { type: 'NpcCancel', target: { unitType: 1, id: CHARSI_ID } },
    ])
    expect(h.commands.some((c) => c.type === 'Move')).toBe(true)
    expect(h.hud.worldPanels.npcMenu).toBeNull()
    expect(h.world.npcInteraction.npcId).toBeNull()
  })
})

describe('Issue #866 — Per-tick unit-removal guard (D2Client 0x6faf83b0) and Stash range guard', () => {
  it('OnlineSession.tick() never closes an open NPC session on walk-away (#890), closes the Stash outside its 1.13c range, and both auto-cancel on S2C 0x0A UnitRemove', () => {
    const session = new OnlineSession()
    session.handleServerEvent({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 1 })
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 0,
        id: 1,
        classId: 1,
        name: 'Hero',
        x: 5000,
        y: 5000,
      },
    })
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: CHARSI_ID,
        classId: 154,
        x: 5003,
        y: 5000, // offset (3, 0): #10407 = 0, inside the 1.13c NPC interaction range (<= 2)
      },
    })
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 2,
        id: STASH_OBJECT_ID,
        classId: STASH_CLASS_ID,
        mode: 0,
        x: 5000,
        y: 5002, // within Stash OperateRange = 2
      },
    })

    // 1. Open NPC session at offset (3, 0): must remain open on tick()
    session.world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: 1, id: CHARSI_ID } })
    session.hudModel.syncFromWorld()
    expect(session.world.npcInteraction.npcId).toBe(CHARSI_ID)
    session.tick(1000)
    expect(session.world.npcInteraction.npcId).toBe(CHARSI_ID)

    // A player position far from the NPC must NOT close it: 0x6faf83b0 never checks the distance (#890).
    const sentBeforeNpcWalk = session.getSentCommands().length
    session.predictor.setPosition(5010, 5010)
    session.tick(1040)
    expect(session.world.npcInteraction.npcId).toBe(CHARSI_ID)
    expect(session.hudManager.worldPanels.npcMenu?.npcId).toBe(CHARSI_ID)
    expect(
      session
        .getSentCommands()
        .slice(sentBeforeNpcWalk)
        .filter((c) => c.type === 'NpcCancel'),
    ).toEqual([])

    // Leaving the NPC is an explicit cancel (world click / menu), which sends C2S 0x30 NpcCancel once
    session.hudModel.cancelNpcSession(CHARSI_ID)
    expect(session.world.npcInteraction.npcId).toBeNull()
    expect(session.hudManager.worldPanels.npcMenu).toBeNull()
    expect(
      session
        .getSentCommands()
        .slice(sentBeforeNpcWalk)
        .filter((c) => c.type === 'NpcCancel'),
    ).toEqual([{ type: 'NpcCancel', target: { unitType: 1, id: CHARSI_ID } }])

    // 2. Open Stash session within 1.13c OperateRange = 2: must remain open on tick()
    session.predictor.setPosition(5000, 5000)
    session.handleServerEvent({ type: 'Trade', action: 0x10 })
    expect(session.world.npcInteraction.stashOpen).toBe(true)
    expect(session.hudManager.leftPanel).toBe('stash')
    expect(session.hudManager.rightPanel).toBe('inv')
    session.tick(1080)
    expect(session.world.npcInteraction.stashOpen).toBe(true)
    expect(session.hudManager.leftPanel).toBe('stash')

    // Move player out of Stash OperateRange -> tick() auto-closes with C2S 0x4F 0x12 CloseStash
    const sentBeforeStashWalk = session.getSentCommands().length
    session.predictor.setPosition(5012, 5012)
    session.tick(1120)
    expect(session.world.npcInteraction.stashOpen).toBe(false)
    expect(session.hudManager.leftPanel).toBe('none')
    expect(session.hudManager.rightPanel).toBe('none')
    const stashCloseCmds = session
      .getSentCommands()
      .slice(sentBeforeStashWalk)
      .filter((c) => c.type === 'ClickButton' && c.buttonId === ClickButtonId.CloseStash)
    expect(stashCloseCmds).toHaveLength(1)

    // 3. S2C 0x0A UnitRemove of active NPC or Stash object closes UI and emits cancel packet
    session.predictor.setPosition(5000, 5000)
    session.world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: 1, id: CHARSI_ID } })
    session.hudModel.syncFromWorld()
    expect(session.world.npcInteraction.npcId).toBe(CHARSI_ID)

    const sentBeforeNpcRemove = session.getSentCommands().length
    session.handleServerEvent({ type: 'UnitRemove', unitType: 1, id: CHARSI_ID })
    expect(session.world.npcInteraction.npcId).toBeNull()
    expect(session.hudManager.worldPanels.npcMenu).toBeNull()
    expect(
      session
        .getSentCommands()
        .slice(sentBeforeNpcRemove)
        .filter((c) => c.type === 'NpcCancel'),
    ).toEqual([{ type: 'NpcCancel', target: { unitType: 1, id: CHARSI_ID } }])

    // Re-open Stash and remove Stash object (0x0A UnitRemove)
    session.handleServerEvent({ type: 'Trade', action: 0x10 })
    expect(session.world.npcInteraction.stashOpen).toBe(true)
    expect(session.hudManager.leftPanel).toBe('stash')

    const sentBeforeStashRemove = session.getSentCommands().length
    session.handleServerEvent({ type: 'UnitRemove', unitType: 2, id: STASH_OBJECT_ID })
    expect(session.world.npcInteraction.stashOpen).toBe(false)
    expect(session.hudManager.leftPanel).toBe('none')
    expect(session.hudManager.rightPanel).toBe('none')
    expect(
      session
        .getSentCommands()
        .slice(sentBeforeStashRemove)
        .filter((c) => c.type === 'ClickButton' && c.buttonId === ClickButtonId.CloseStash),
    ).toHaveLength(1)
  })

  it('OnlineSession.tick() auto-cancels open Stash when local player enters death mode (mode = 17)', () => {
    const session = new OnlineSession()
    session.handleServerEvent({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 1 })
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 0,
        id: 1,
        classId: 1,
        name: 'Hero',
        x: 5000,
        y: 5000,
      },
    })
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 2,
        id: STASH_OBJECT_ID,
        classId: STASH_CLASS_ID,
        mode: 0,
        x: 5000,
        y: 5001,
      },
    })
    session.handleServerEvent({ type: 'Trade', action: 0x10 })
    expect(session.hudManager.leftPanel).toBe('stash')

    const sentBeforeDeath = session.getSentCommands().length
    session.handleServerEvent({ type: 'UnitMode', unitType: 0, id: 1, mode: 17 })
    session.tick(2000)

    expect(session.world.npcInteraction.stashOpen).toBe(false)
    expect(session.hudManager.leftPanel).toBe('none')
    expect(session.hudManager.rightPanel).toBe('none')
    expect(
      session
        .getSentCommands()
        .slice(sentBeforeDeath)
        .filter((c) => c.type === 'ClickButton' && c.buttonId === ClickButtonId.CloseStash),
    ).toHaveLength(1)
  })
})
