/**
 * #1554: Configure Controls exposes every D2Client.dll command of 0x6FBA4F10 that the web client can
 * act on (run, eight say messages, clear messages, show portraits, skills 9..16).
 */
import { describe, expect, it } from 'vitest'
import { D2_CMD } from '../src/client/settings/default-key-113c.ts'
import {
  CONTROL_ACTION_DEFINITIONS,
  SAY_MESSAGE_PHRASE_113C,
  createDefaultKeyBindings,
} from '../src/client/settings/key-bindings.ts'
import { CommandMapper } from '../src/client/input/command-mapper.ts'
import { LocalMovementPredictor } from '../src/client/motion/predictor.ts'
import { OutboundRateLimiter } from '../src/client/session/rate-limiter.ts'
import { HudModel } from '../src/client/ui-model/hud-model.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import type { ClientCommand } from '../src/netproto/index.ts'

describe('command coverage', () => {
  it('every command id 0..56 except game menu (Esc, fixed) and screenshot (host OS) is configurable', () => {
    const covered = new Set(CONTROL_ACTION_DEFINITIONS.map((d) => d.cmdId))
    for (let cmd = 0; cmd <= 56; cmd++) {
      if (cmd === D2_CMD.gameMenu || cmd === D2_CMD.screenshot) continue
      expect([cmd, covered.has(cmd)]).toEqual([cmd, true])
    }
    expect(new Set(CONTROL_ACTION_DEFINITIONS.map((d) => d.id)).size).toBe(CONTROL_ACTION_DEFINITIONS.length)
  })

  it('say messages default to Numpad 0..7 and phrases 0x19..0x20', () => {
    const kb = createDefaultKeyBindings()
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((n) => (kb as any)[`sayMessage${n}`].primary)).toEqual(
      ['Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'Numpad6', 'Numpad7'],
    )
    expect(Object.values(SAY_MESSAGE_PHRASE_113C)).toEqual([0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20])
    expect(kb.run).toEqual({ primary: null, secondary: null })
    expect(kb.selectSkill9).toEqual({ primary: null, secondary: null })
    expect(kb.clearMessages.primary).toBe('KeyN')
    expect(kb.showPortraits.primary).toBe('KeyZ')
  })
})

describe('rebinding the new commands', () => {
  function setup() {
    const world = new ClientWorld()
    const hudManager = new HudManager()
    const sent: ClientCommand[] = []
    const hudModel = new HudModel({ world, hudManager, onCommand: (c) => sent.push(c) })
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 1, areaId: 2 })
    world.apply({ type: 'PlayerAssign', unitId: 1, classId: 1, name: 'Hero', x: 5000, y: 5000 })
    const mapper = new CommandMapper({
      world,
      hudManager,
      hudModel,
      predictor: new LocalMovementPredictor(),
      rateLimiter: new OutboundRateLimiter({ moveMinIntervalMs: 0 }),
      sendCommand: (c) => sent.push(c),
    })
    const kb = createDefaultKeyBindings()
    ;(hudManager as any).getActiveKeyBindings = () => kb
    return { hudManager, mapper, sent, kb }
  }

  it('a rebound say key sends its phrase and the old Numpad key no longer does', () => {
    const { mapper, sent, kb } = setup()
    kb.sayMessage2 = { primary: 'KeyK', secondary: null }
    mapper.handleKeyDown({ key: 'k', code: 'KeyK' })
    mapper.handleKeyDown({ key: '1', code: 'Numpad1' })
    expect(sent.filter((c) => c.type === 'Say')).toEqual([{ type: 'Say', phraseId: 0x1a }])
  })

  it('rebinding Show Portraits moves it off Z', () => {
    const { hudManager, mapper, kb } = setup()
    kb.showPortraits = { primary: 'KeyJ', secondary: null }
    const before = hudManager.showPartyPortraits
    mapper.handleKeyDown({ key: 'z', code: 'KeyZ' })
    expect(hudManager.showPartyPortraits).toBe(before)
    mapper.handleKeyDown({ key: 'j', code: 'KeyJ' })
    expect(hudManager.showPartyPortraits).toBe(!before)
  })
})

describe('#1566 no hardcoded command keys', () => {
  function setup2() {
    const world = new ClientWorld()
    const hudManager = new HudManager()
    const hudModel = new HudModel({ world, hudManager, onCommand: () => {} })
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 1, areaId: 2 })
    world.apply({ type: 'PlayerAssign', unitId: 1, classId: 1, name: 'Hero', x: 5000, y: 5000 })
    const mapper = new CommandMapper({
      world,
      hudManager,
      hudModel,
      predictor: new LocalMovementPredictor(),
      rateLimiter: new OutboundRateLimiter({ moveMinIntervalMs: 0 }),
      sendCommand: () => {},
    })
    const kb = createDefaultKeyBindings()
    ;(hudManager as any).getActiveKeyBindings = () => kb
    return { hudManager, mapper, kb }
  }

  it('after moving Inventory to K, I and B no longer open it', () => {
    const { hudManager, mapper, kb } = setup2()
    kb.inventoryScreen = { primary: 'KeyK', secondary: null }
    mapper.handleKeyDown({ key: 'i', code: 'KeyI' })
    mapper.handleKeyDown({ key: 'b', code: 'KeyB' })
    expect(hudManager.rightPanel).toBe('none')
    mapper.handleKeyDown({ key: 'k', code: 'KeyK' })
    expect(hudManager.rightPanel).toBe('inv')
  })

  it('after clearing Character Screen, A and C do nothing', () => {
    const { hudManager, mapper, kb } = setup2()
    kb.characterScreen = { primary: null, secondary: null }
    expect(mapper.handleKeyDown({ key: 'c', code: 'KeyC' })).toBe(false)
    expect(mapper.handleKeyDown({ key: 'a', code: 'KeyA' })).toBe(false)
    expect(hudManager.leftPanel).toBe('none')
  })
})

describe('#1572 / #1574 dead player command gates', () => {
  it('skill hotkeys, belt and quest log do nothing while dead', () => {
    const world = new ClientWorld()
    const hudManager = new HudManager()
    const sent: ClientCommand[] = []
    const hudModel = new HudModel({ world, hudManager, onCommand: (c) => sent.push(c) })
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 1, areaId: 2 })
    world.apply({ type: 'PlayerAssign', unitId: 1, classId: 1, name: 'Hero', x: 5000, y: 5000 })
    const mapper = new CommandMapper({
      world,
      hudManager,
      hudModel,
      predictor: new LocalMovementPredictor(),
      rateLimiter: new OutboundRateLimiter({ moveMinIntervalMs: 0 }),
      sendCommand: (c) => sent.push(c),
    })
    mapper.bindSkillHotkey('F1', { hand: 'right', skillId: 54 })
    Object.defineProperty(world, 'isSelfDead', { get: () => true, configurable: true })
    mapper.handleKeyDown({ key: 'F1', code: 'F1' })
    mapper.handleKeyDown({ key: '1', code: 'Digit1' })
    mapper.handleKeyDown({ key: 'q', code: 'KeyQ' })
    expect(sent).toEqual([])
    expect(hudManager.leftPanel).toBe('none')
  })
})

describe('#1616 Party on Automap & #1617 Select Previous/Next Skill', () => {
  it('F11 (partyOnAutomap) triggers onToggleAutomapParty callback on HudManager', () => {
    const world = new ClientWorld()
    let toggled = 0
    const hudManager = new HudManager(null, {
      onToggleAutomapParty: () => {
        toggled++
      },
    })
    const hudModel = new HudModel({ world, hudManager, onCommand: () => {} })
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 1, areaId: 2 })
    world.apply({ type: 'PlayerAssign', unitId: 1, classId: 1, name: 'Hero', x: 5000, y: 5000 })
    const mapper = new CommandMapper({
      world,
      hudManager,
      hudModel,
      predictor: new LocalMovementPredictor(),
      rateLimiter: new OutboundRateLimiter({ moveMinIntervalMs: 0 }),
      sendCommand: () => {},
    })
    const kb = createDefaultKeyBindings()
    ;(hudManager as any).getActiveKeyBindings = () => kb
    expect(mapper.handleKeyDown({ key: 'F11', code: 'F11' })).toBe(true)
    expect(toggled).toBe(1)
  })

  it('Select Previous / Next Skill cycles right-hand bound hotkey slots via wheel or keyboard and skips left-hand slots (0x6FAED6D0)', () => {
    const world = new ClientWorld()
    const hudManager = new HudManager()
    const sent: ClientCommand[] = []
    const hudModel = new HudModel({ world, hudManager, onCommand: (c) => sent.push(c) })
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 1, areaId: 2 })
    world.apply({ type: 'PlayerAssign', unitId: 1, classId: 1, name: 'Hero', x: 5000, y: 5000 })
    world.apply({ type: 'BaseSkillLevels', skills: [
      { skillId: 36, level: 1 },
      { skillId: 37, level: 1 },
      { skillId: 54, level: 1 },
    ] })
    const mapper = new CommandMapper({
      world,
      hudManager,
      hudModel,
      predictor: new LocalMovementPredictor(),
      rateLimiter: new OutboundRateLimiter({ moveMinIntervalMs: 0 }),
      sendCommand: (c) => sent.push(c),
    })
    const kb = createDefaultKeyBindings()
    ;(hudManager as any).getActiveKeyBindings = () => kb

    // Bind F1 (right: 36), F2 (left: 37), F4 (right: 54)
    mapper.bindSkillHotkey('F1', { hand: 'right', skillId: 36 })
    mapper.bindSkillHotkey('F2', { hand: 'left', skillId: 37 })
    mapper.bindSkillHotkey('F4', { hand: 'right', skillId: 54 })

    // Select F1 initially so lastSelectedSlot = 0
    mapper.handleKeyDown({ key: 'F1', code: 'F1' })
    expect(sent.at(-1)).toEqual({ type: 'SelectSkill', hand: 'right', skill: 36, itemId: 0xffffffff })

    // WheelDown (selectNextSkill, +1): should skip F2 (left-hand) and F3 (unbound) -> select F4 (54)
    expect(mapper.handleWheel(100)).toBe(true)
    expect(sent.at(-1)).toEqual({ type: 'SelectSkill', hand: 'right', skill: 54, itemId: 0xffffffff })

    // WheelUp (selectPreviousSkill, -1): should step back from slot 3 -> 0 (36)
    expect(mapper.handleWheel(-100)).toBe(true)
    expect(sent.at(-1)).toEqual({ type: 'SelectSkill', hand: 'right', skill: 36, itemId: 0xffffffff })

    // Rebind selectNextSkill to BracketRight and trigger via keyboard
    kb.selectNextSkill = { primary: 'BracketRight', secondary: null }
    expect(mapper.handleKeyDown({ key: ']', code: 'BracketRight' })).toBe(true)
    expect(sent.at(-1)).toEqual({ type: 'SelectSkill', hand: 'right', skill: 54, itemId: 0xffffffff })
  })
})
