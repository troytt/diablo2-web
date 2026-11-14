/**
 * D2Client.dll 0x6fae8bb0 keydown command dispatcher:
 *   6fae8bb5: test dword [msg+0xc], 0x40000000   ; lParam bit30 (auto-repeat)
 *   6fae8bbc: jne  0x6fae8ca5                     ; skip, no command fnDown
 * Holding a command key must run its action exactly once.
 */
import { describe, expect, it } from 'vitest'
import { CommandMapper } from '../src/client/input/command-mapper.ts'
import { LocalMovementPredictor } from '../src/client/motion/predictor.ts'
import { OutboundRateLimiter } from '../src/client/session/rate-limiter.ts'
import { HudModel } from '../src/client/ui-model/hud-model.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import type { ClientCommand } from '../src/netproto/index.ts'

function setup() {
  const world = new ClientWorld()
  const hudManager = new HudManager()
  const sent: ClientCommand[] = []
  const hudModel = new HudModel({ world, hudManager, onCommand: (cmd) => sent.push(cmd) })
  const predictor = new LocalMovementPredictor()
  predictor.setPosition(5000, 5000)
  world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 2 })
  world.apply({ type: 'PlayerAssign', unitId: 1, classId: 1, name: 'Hero', x: 5000, y: 5000 })
  const mapper = new CommandMapper({
    world,
    hudManager,
    hudModel,
    predictor,
    rateLimiter: new OutboundRateLimiter({ moveMinIntervalMs: 0 }),
    sendCommand: (cmd) => sent.push(cmd),
  })
  return { world, hudManager, mapper, sent }
}

describe('keyboard auto-repeat filter (D2Client.dll 0x6fae8bb5)', () => {
  it('holding I toggles the inventory only once', () => {
    const { hudManager, mapper } = setup()
    expect(mapper.handleKeyDown({ key: 'i', code: 'KeyI' })).toBe(true)
    expect(hudManager.rightPanel).toBe('inv')
    for (let i = 0; i < 5; i++) {
      expect(mapper.handleKeyDown({ key: 'i', code: 'KeyI', repeat: true })).toBe(true)
    }
    expect(hudManager.rightPanel).toBe('inv')
  })

  it('holding C toggles the character screen only once', () => {
    const { hudManager, mapper } = setup()
    mapper.handleKeyDown({ key: 'c', code: 'KeyC' })
    expect(hudManager.leftPanel).toBe('char')
    mapper.handleKeyDown({ key: 'c', code: 'KeyC', repeat: true })
    mapper.handleKeyDown({ key: 'c', code: 'KeyC', repeat: true })
    expect(hudManager.leftPanel).toBe('char')
  })

  it('auto-repeated keydowns emit no client commands (Numpad say, swap weapons)', () => {
    const { mapper, sent } = setup()
    mapper.handleKeyDown({ key: '1', code: 'Numpad1' }, 1000)
    const afterFirst = sent.length
    mapper.handleKeyDown({ key: '1', code: 'Numpad1', repeat: true }, 5000)
    mapper.handleKeyDown({ key: 'w', code: 'KeyW', repeat: true }, 6000)
    expect(sent.length).toBe(afterFirst)
  })
})
