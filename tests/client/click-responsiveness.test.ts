import { describe, expect, it } from 'vitest'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import { LocalMovementPredictor } from '../../src/client/motion/predictor.ts'
import {
  classifyClientCommand,
  DEFAULT_RATE_LIMITS,
  OutboundRateLimiter,
} from '../../src/client/session/rate-limiter.ts'
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
  return { world, hudModel, mapper, sent, movesSent }
}

describe('OutboundRateLimiter fresh presses', () => {
  it('defaults moveMinIntervalMs to 0 for 1.13c parity (#1706)', () => {
    expect(DEFAULT_RATE_LIMITS.moveMinIntervalMs).toBe(0)
    const limiter = new OutboundRateLimiter()
    expect(limiter.tryAcquire(MOVE, 1000).allowed).toBe(true)
    expect(limiter.tryAcquire(MOVE, 1050).allowed).toBe(true)
  })

  it('still coalesces repeated movement inside an opt-in cooldown', () => {
    const limiter = new OutboundRateLimiter({ moveMinIntervalMs: 120 })
    expect(limiter.tryAcquire(MOVE, 1000).allowed).toBe(true)
    expect(limiter.tryAcquire(MOVE, 1050).coalesced).toBe(true)
  })

  it('sends a fresh press immediately and restarts the opt-in cooldown for holds', () => {
    const limiter = new OutboundRateLimiter({ moveMinIntervalMs: 120 })
    expect(limiter.tryAcquire(MOVE, 1000).allowed).toBe(true)
    expect(limiter.tryAcquire(MOVE, 1050, { freshPress: true }).allowed).toBe(true)
    expect(limiter.tryAcquire(MOVE, 1100).allowed).toBe(false)
    expect(limiter.tryAcquire(MOVE, 1170).allowed).toBe(true)
  })

  it('drops a coalesced hold move once a fresh press goes out', () => {
    const limiter = new OutboundRateLimiter({ moveMinIntervalMs: 120 })
    limiter.tryAcquire(MOVE, 1000)
    limiter.tryAcquire(MOVE, 1040)
    limiter.tryAcquire({ type: 'RunToLocation', x: 4990, y: 5000 }, 1060, { freshPress: true })
    expect(limiter.flushPendingMove(2000)).toBeNull()
  })
})

describe('CommandMapper click responsiveness & 1.13c walkAdjust (D2Client.dll 0x6FAC86A0, #1706)', () => {
  it('sends back-to-back ground clicks without waiting for a movement cooldown', () => {
    const { mapper, movesSent } = createSetup()
    mapper.triggerPrimaryWorldAction(5010, 5000, null, 1000)
    mapper.triggerPrimaryWorldAction(4990, 5004, null, 1050)
    expect(movesSent()).toBe(2)
  })

  it('throttles hold-to-walk repeats via the 1.13c 7-frame window (0x6FAC8820..0x6FAC885A)', () => {
    const { mapper, movesSent } = createSetup()
    // Press at frame 25 (1000ms) -> accepted, sets mode 3 (run) and lastWalkFrame = 25
    mapper.triggerPrimaryWorldAction(5010, 5000, null, 1000)
    // Holds at frames 26..31 (1040..1240ms, delta 1..6 < 7) -> rejected without updating lastWalkFrame
    mapper.triggerPrimaryWorldAction(5012, 5000, null, 1040, true)
    mapper.triggerPrimaryWorldAction(5014, 5000, null, 1080, true)
    mapper.triggerPrimaryWorldAction(5016, 5000, null, 1240, true)
    expect(movesSent()).toBe(1)
    // Hold at frame 32 (1280ms, delta 7 >= 7) -> accepted!
    mapper.triggerPrimaryWorldAction(5018, 5000, null, 1280, true)
    expect(movesSent()).toBe(2)
  })

  it('expands close clicks to minStep (run: 5, walk down: 3, walk hold: 4) and rejects |dx|>=0x100 or dx=dy=0 (0x6FAC873C..0x6FAC881D)', () => {
    const { world, hudModel, mapper, sent } = createSetup()
    // Zero offset (dx=0, dy=0) -> rejected
    expect(mapper.triggerPrimaryWorldAction(5000, 5000, null, 1000)).toBeNull()
    // Out-of-range (|dx| >= 256) -> rejected
    expect(mapper.triggerPrimaryWorldAction(5256, 5000, null, 1000)).toBeNull()
    expect(mapper.triggerPrimaryWorldAction(5000, 4744, null, 1000)).toBeNull()
    expect(sent).toHaveLength(0)

    // Run press 1 subtile east (approxDist=1 < minStep=5) -> expanded to +5 (5005, 5000)
    const runRec = mapper.triggerPrimaryWorldAction(5001, 5000, null, 1000)
    expect(runRec?.command).toEqual({
      type: 'Move',
      run: true,
      to: { x: 5005, y: 5000 },
    })

    // Walk mode: press 1 subtile south -> expanded to +3 (5000, 5003); hold 7 frames later -> expanded to +4 (5000, 5004)
    hudModel.toggleRunWalk()
    const walkDown = mapper.triggerPrimaryWorldAction(5000, 5001, null, 2000)
    expect(walkDown?.command).toEqual({
      type: 'Move',
      run: false,
      to: { x: 5000, y: 5003 },
    })
    const walkHold = mapper.triggerPrimaryWorldAction(5000, 5001, null, 2280, true)
    expect(walkHold?.command).toEqual({
      type: 'Move',
      run: false,
      to: { x: 5000, y: 5004 },
    })
  })
})
