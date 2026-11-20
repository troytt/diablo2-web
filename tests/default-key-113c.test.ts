/**
 * #1553: Configure Controls defaults must be the verbatim 1.13c `default.key`
 * (D2Client.dll 0x6FBCA2E0 binding table, written by 0x6FAE9A60).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  D2_CMD,
  DEFAULT_KEY_113C,
  VK_NONE,
  defaultBindingCodesForCommand,
} from '../src/client/settings/default-key-113c.ts'
import {
  CONTROL_ACTION_DEFINITIONS,
  createDefaultKeyBindings,
  matchesKeyBinding,
  sanitizeKeyBindings,
} from '../src/client/settings/key-bindings.ts'
import { CommandMapper } from '../src/client/input/command-mapper.ts'
import { LocalMovementPredictor } from '../src/client/motion/predictor.ts'
import { OutboundRateLimiter } from '../src/client/session/rate-limiter.ts'
import { HudModel } from '../src/client/ui-model/hud-model.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'

const KEY_FILE = join(process.env.D2_DATA_DIR ?? 'samples/d2', 'default.key')

describe('default.key (1.13c) binding table', () => {
  it.skipIf(!existsSync(KEY_FILE))('DEFAULT_KEY_113C matches the shipped default.key record-by-record', () => {
    const buf = readFileSync(KEY_FILE)
    // The shipped file carries extra records for command ids >= 0x39 after the 114 records the 1.13c
    // client reads (0x6FAE9910 reads exactly `0x47A` bytes); the dispatcher ignores cmdId >= 0x39 (0x6fae8be1).
    expect(buf.length).toBeGreaterThanOrEqual(6 + 114 * 10)
    expect(buf.readUInt16LE(0)).toBe(0x5357) // 'WS'
    expect(buf.readUInt16LE(2)).toBe(0x25)
    expect(buf.readUInt16LE(4)).toBe(0x47a)
    const byCmd = new Map<number, number[]>()
    for (let i = 0; i < 114; i++) {
      const o = 6 + i * 10
      const cmd = buf.readUInt32LE(o)
      const vk = buf.readUInt16LE(o + 4)
      byCmd.set(cmd, [...(byCmd.get(cmd) ?? []), vk])
    }
    expect(byCmd.size).toBe(57)
    for (let cmd = 0; cmd < 57; cmd++) {
      expect([cmd, ...byCmd.get(cmd)!]).toEqual([cmd, ...DEFAULT_KEY_113C[cmd]!])
    }
  })

  it('every Configure Controls action takes its defaults from its default.key command record', () => {
    for (const def of CONTROL_ACTION_DEFINITIONS) {
      expect([def.id, def.defaultPrimary, def.defaultSecondary]).toEqual([
        def.id,
        ...defaultBindingCodesForCommand(def.cmdId),
      ])
    }
  })

  it('F9 = Center Automap, F10 = Fade Automap, F11 = Party, F12 = Names, Home unbound', () => {
    const kb = createDefaultKeyBindings()
    expect(kb.centerAutomap.primary).toBe('F9')
    expect(kb.fadeAutomap.primary).toBe('F10')
    expect(kb.partyOnAutomap.primary).toBe('F11')
    expect(kb.namesOnAutomap.primary).toBe('F12')
    expect(DEFAULT_KEY_113C[D2_CMD.run]).toEqual([VK_NONE, VK_NONE])
    for (const def of CONTROL_ACTION_DEFINITIONS) {
      expect(matchesKeyBinding(kb, def.id, { key: 'Home', code: 'Home' })).toBe(false)
    }
  })

  it('side-agnostic Win32 VKs: Shift/Alt match either side, Enter matches the keypad Enter', () => {
    const kb = createDefaultKeyBindings()
    expect(matchesKeyBinding(kb, 'standStill', { key: 'Shift', code: 'ShiftRight' })).toBe(true)
    expect(matchesKeyBinding(kb, 'standStill', { key: 'Shift', code: 'ShiftLeft' })).toBe(true)
    expect(matchesKeyBinding(kb, 'showItems', { key: 'Alt', code: 'AltRight' })).toBe(true)
    expect(matchesKeyBinding(kb, 'say', { key: 'Enter', code: 'NumpadEnter' })).toBe(true)
    expect(matchesKeyBinding(kb, 'standStill', { key: 'Shift' })).toBe(true)
  })

  it('migrates untouched pre-default.key persisted defaults, keeps customised slots', () => {
    const migrated = sanitizeKeyBindings({
      centerAutomap: { primary: 'Home', secondary: null },
      fadeAutomap: { primary: 'F9', secondary: null },
      standStill: { primary: 'ShiftLeft', secondary: 'ShiftRight' },
      inventoryScreen: { primary: 'KeyK', secondary: null },
    })
    expect(migrated.centerAutomap.primary).toBe('F9')
    expect(migrated.fadeAutomap.primary).toBe('F10')
    expect(migrated.standStill).toEqual({ primary: 'Shift', secondary: null })
    expect(migrated.inventoryScreen).toEqual({ primary: 'KeyK', secondary: null })
  })
})

describe('CommandMapper automap hotkeys follow default.key', () => {
  function setup() {
    const world = new ClientWorld()
    const hudManager = new HudManager()
    const hudModel = new HudModel({ world, hudManager, onCommand: () => {} })
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 1, areaId: 2 })
    world.apply({ type: 'PlayerAssign', unitId: 1, classId: 1, name: 'Hero', x: 5000, y: 5000 })
    const onAutomapCenter = vi.fn()
    const onAutomapFade = vi.fn()
    const onAutomapNames = vi.fn()
    const onAutomapParty = vi.fn()
    const mapper = new CommandMapper({
      world,
      hudManager,
      hudModel,
      predictor: new LocalMovementPredictor(),
      rateLimiter: new OutboundRateLimiter({ moveMinIntervalMs: 0 }),
      sendCommand: () => {},
      onAutomapCenter,
      onAutomapFade,
      onAutomapNames,
      onAutomapParty,
    } as any)
    return { mapper, onAutomapCenter, onAutomapFade, onAutomapNames, onAutomapParty }
  }

  it('F9 centers, F10 fades, F11 party, F12 names, Home does nothing', () => {
    const s = setup()
    s.mapper.handleKeyDown({ key: 'F9', code: 'F9' })
    expect(s.onAutomapCenter).toHaveBeenCalledTimes(1)
    expect(s.onAutomapFade).not.toHaveBeenCalled()
    s.mapper.handleKeyDown({ key: 'F10', code: 'F10' })
    expect(s.onAutomapFade).toHaveBeenCalledTimes(1)
    expect(s.onAutomapNames).not.toHaveBeenCalled()
    s.mapper.handleKeyDown({ key: 'F11', code: 'F11' })
    expect(s.onAutomapParty).toHaveBeenCalledTimes(1)
    s.mapper.handleKeyDown({ key: 'F12', code: 'F12' })
    expect(s.onAutomapNames).toHaveBeenCalledTimes(1)
    expect(s.mapper.handleKeyDown({ key: 'Home', code: 'Home' })).toBe(false)
    expect(s.onAutomapCenter).toHaveBeenCalledTimes(1)
  })
})
