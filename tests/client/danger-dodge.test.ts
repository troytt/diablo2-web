import { describe, expect, it } from 'vitest'
import { CommandMapper, ViewportCamera } from '../../src/client/input/command-mapper.ts'
import { LocalMovementPredictor } from '../../src/client/motion/predictor.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { MISSILE_DATA } from '../../src/common/skills/missiles-data.ts'
import type { ClientCommand } from '../../src/netproto/index.ts'

const createSetup = () => {
  const world = new ClientWorld()
  world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 2 })
  world.apply({ type: 'UnitAssign', unit: { unitType: 0, id: 1, classId: 1, name: 'Hero', x: 100, y: 100 }, isSelf: true })
  const hudManager = new HudManager()
  hudManager.resize(800, 600)
  const predictor = new LocalMovementPredictor({ initialX: 100, initialY: 100 })
  const camera = new ViewportCamera('800x600')
  camera.snapTo(100, 100)
  const sent: ClientCommand[] = []
  const hudModel = new HudModel({ world, hudManager, predictor, onCommand: (cmd) => sent.push(cmd) })
  const mapper = new CommandMapper({ world, camera, hudManager, hudModel, predictor, sendCommand: (cmd) => sent.push(cmd) })
  mapper.assists.autoCombatKey = 'E'
  mapper.handleKeyDown({ key: 'e' })
  Object.assign(mapper.assists, { pilot: { active: true, tick: () => undefined } })
  const dodges: unknown[] = []
  mapper.assists.journal = (kind, detail) => {
    if (kind === 'dodge') dodges.push(detail)
  }
  world.apply({ type: 'UnitAssign', unit: { unitType: 1, id: 901, classId: 19, name: 'Monster', x: 112, y: 100, lifePct: 128, mode: 1 } })
  const fire = (name: string, owner: { unitType: number; id: number }, at: { x: number; y: number }, target: { x: number; y: number }) =>
    world.apply({ type: 'CreateMissile', missileClassId: MISSILE_DATA[name]!.id, owner, at, target } as never)
  const moves = () => sent.filter((c) => c.type === 'RunToLocation' || c.type === 'WalkToLocation') as { x: number; y: number }[]
  return { world, mapper, sent, fire, moves, dodges }
}

describe('dodging hostile missiles and ground hazards', () => {
  it('sidesteps a fireball flying at the player', () => {
    const s = createSetup()
    s.fire('fireball', { unitType: 1, id: 901 }, { x: 110, y: 100 }, { x: 100, y: 100 })
    s.mapper.assists.tick(1000)
    const step = s.moves().at(-1)!
    expect(s.dodges).toHaveLength(1)
    expect(Math.abs(step.y - 100)).toBeGreaterThanOrEqual(3)
  })

  it('steps out of a poison cloud under the player', () => {
    const s = createSetup()
    s.fire('corpsepoisoncloud', { unitType: 1, id: 901 }, { x: 100, y: 100 }, { x: 100, y: 100 })
    s.mapper.assists.tick(1000)
    const step = s.moves().at(-1)!
    expect(s.dodges).toHaveLength(1)
    expect(Math.hypot(step.x - 100, step.y - 100)).toBeGreaterThan(4)
  })

  it('ignores its own missiles', () => {
    const s = createSetup()
    s.fire('fireball', { unitType: 0, id: 1 }, { x: 110, y: 100 }, { x: 100, y: 100 })
    s.fire('corpsepoisoncloud', { unitType: 0, id: 1 }, { x: 100, y: 100 }, { x: 100, y: 100 })
    s.mapper.assists.tick(1000)
    expect(s.dodges).toEqual([])
  })

  it('holds the attack while dodging, then swings again', () => {
    const s = createSetup()
    s.fire('fireball', { unitType: 1, id: 901 }, { x: 110, y: 100 }, { x: 100, y: 100 })
    s.mapper.assists.tick(1000)
    const attacks = () => s.sent.filter((c) => c.type === 'SkillOn' || c.type === 'SkillAt').length
    expect(attacks()).toBe(0)
    for (const unit of s.world.getUnitsByType(3)) unit.vx = unit.vy = 0
    for (let t = 1800; t <= 2200; t += 40) s.mapper.assists.tick(t)
    expect(attacks()).toBeGreaterThan(0)
  })
})
