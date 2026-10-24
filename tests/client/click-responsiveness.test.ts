import { describe, expect, it } from 'vitest'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import { LocalMovementPredictor } from '../../src/client/motion/predictor.ts'
import { classifyClientCommand, OutboundRateLimiter } from '../../src/client/session/rate-limiter.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import type { ClientCommand } from '../../src/netproto/index.ts'

const MOVE: ClientCommand = { type: 'RunToLocation', x: 5010, y: 5000 }

function createSetup() {
  const world = new ClientWorld()
  const hudManager = new HudManager()
  const sent: ClientCommand[] = []
  const hudModel = new HudModel({ world, hudManager, onCommand: (cmd) => sent.push(cmd) })
  const predictor = new LocalMovementPredictor()
  predictor.setPosition(5000, 5000)
  world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 2 })
  world.apply({ type: 'PlayerAssign', unitId: 1, classId: 1, name: 'Hero', x: 5000, y: 5000 })
  const mapper = new CommandMapper({ world, hudManager, hudModel, predictor, rateLimiter: new OutboundRateLimiter(), sendCommand: (cmd) => sent.push(cmd) })
  const movesSent = () => sent.filter((c) => classifyClientCommand(c) === 'movement').length
  return { world, mapper, movesSent }
}

describe('OutboundRateLimiter fresh presses', () => {
  it('still coalesces repeated movement inside the cooldown', () => {
    const limiter = new OutboundRateLimiter()
    expect(limiter.tryAcquire(MOVE, 1000).allowed).toBe(true)
    expect(limiter.tryAcquire(MOVE, 1050).coalesced).toBe(true)
  })

  it('sends a fresh press immediately and restarts the cooldown for holds', () => {
    const limiter = new OutboundRateLimiter()
    expect(limiter.tryAcquire(MOVE, 1000).allowed).toBe(true)
    expect(limiter.tryAcquire(MOVE, 1050, { freshPress: true }).allowed).toBe(true)
    expect(limiter.tryAcquire(MOVE, 1100).allowed).toBe(false)
    expect(limiter.tryAcquire(MOVE, 1170).allowed).toBe(true)
  })

  it('drops a coalesced hold move once a fresh press goes out', () => {
    const limiter = new OutboundRateLimiter()
    limiter.tryAcquire(MOVE, 1000)
    limiter.tryAcquire(MOVE, 1040)
    limiter.tryAcquire({ type: 'RunToLocation', x: 4990, y: 5000 }, 1060, { freshPress: true })
    expect(limiter.flushPendingMove(2000)).toBeNull()
  })
})

describe('CommandMapper click responsiveness', () => {
  it('sends back-to-back ground clicks without waiting for the movement cooldown', () => {
    const { mapper, movesSent } = createSetup()
    mapper.triggerPrimaryWorldAction(5010, 5000, null, 1000)
    mapper.triggerPrimaryWorldAction(4990, 5004, null, 1050)
    expect(movesSent()).toBe(2)
  })

  it('keeps throttling hold-to-walk repeats', () => {
    const { mapper, movesSent } = createSetup()
    mapper.triggerPrimaryWorldAction(5010, 5000, null, 1000)
    mapper.triggerPrimaryWorldAction(5012, 5000, null, 1040, true)
    mapper.triggerPrimaryWorldAction(5014, 5000, null, 1080, true)
    expect(movesSent()).toBe(1)
  })
})
