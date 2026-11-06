/**
 * #1552: D2Client.dll 0x6fae8c28 -- in input mode 2 (NPC shop / stash / cube / NPC dialog) only the
 * commands flagged `dwAllowInModal` in 0x6FBA4F10 are dispatched.
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
  world.apply({ type: 'LoadAct', act: 0, mapSeed: 1, areaId: 1 })
  world.apply({ type: 'PlayerAssign', unitId: 1, classId: 1, name: 'Hero', x: 5000, y: 5000 })
  const mapper = new CommandMapper({
    world,
    hudManager,
    hudModel,
    predictor: new LocalMovementPredictor(),
    rateLimiter: new OutboundRateLimiter({ moveMinIntervalMs: 0 }),
    sendCommand: (cmd) => sent.push(cmd),
  })
  return { hudManager, mapper, sent }
}

describe('modal input mode (stash/cube/shop/NPC dialog)', () => {
  it('blocks character/quest/party/skill-tree/speed-bar hotkeys while the stash is open', () => {
    const { hudManager, mapper } = setup()
    hudManager.toggleLeftPanel('stash')
    for (const k of ['c', 'q', 'p', 't', 's', 'h', 'm', ' ']) {
      mapper.handleKeyDown({ key: k, code: k === ' ' ? 'Space' : `Key${k.toUpperCase()}` })
    }
    expect(hudManager.leftPanel).toBe('stash')
    expect(hudManager.rightPanel).toBe('inv')
    expect(hudManager.hotkeys.openPopup).toBeNull()
    expect(hudManager.helpOverlayOpen).toBe(false)
  })

  it('still dispatches the dwAllowInModal commands: show belt, swap weapons', () => {
    const { hudManager, mapper, sent } = setup()
    hudManager.toggleLeftPanel('stash')
    mapper.handleKeyDown({ key: '`', code: 'Backquote' })
    expect(hudManager.belt.lockedOpen).toBe(true)
    mapper.handleKeyDown({ key: 'w', code: 'KeyW' }, 10_000)
    expect(sent.some((c) => c.type === 'SwapWeapons')).toBe(true)
  })

  it('belt potion keys do not fire while the stash is open', () => {
    const { hudManager, mapper, sent } = setup()
    hudManager.toggleLeftPanel('stash')
    mapper.handleKeyDown({ key: '1', code: 'Digit1' })
    expect(sent.some((c) => c.type === 'BeltUse')).toBe(false)
  })

  it('outside the modal mode the same keys work', () => {
    const { hudManager, mapper } = setup()
    mapper.handleKeyDown({ key: 'c', code: 'KeyC' })
    expect(hudManager.leftPanel).toBe('char')
  })
})
